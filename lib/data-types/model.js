import {shallowRef, triggerRef, shallowReactive, watch, reactive} from "vue";
import {ref, unref} from "@vue/reactivity";
import {Database} from "ef-vue-crust";
import DataType from "ef-vue-crust/data-types/data-type";
import Enum from "ef-vue-crust/data-types/enum";
import Guid from "ef-vue-crust/data-types/guid";
import Validate from "../helpers/validator";
import Connection from "../connection";


/**
 * Array of Models that returns references to Database records when appropriate 
 */
const Collection = function(prop, foreignKey){
    const _value = [...this[foreignKey]];
    
    let type = this._properties[prop].type;
    if (Array.isArray(type)){
        type = type[0];
    }

    return new Proxy(_value, {
        get: (target, i) => {
            if (i.constructor === Symbol){
                return null;
            }
            //TODO typecheck for guid
            if (Number.isInteger(Number(i)) && _checkKey(type.properties.id.type, _value[i])){
                return Database[type.name][_value[i]];
            }
            return target[i];
        },
        set: (target, i, value) => {
            if (Number.isInteger(Number(i)) && _checkKey(type.properties.id.type, _value[i])){
                this[foreignKey][i] = value;
            }
            target[i] = value;
            this._modified = true;
            return true;
        }
    });
}

const _foreignKey = function(prop){
    const propInfo = this._properties[prop];
    if (propInfo.config && propInfo.config.foreignKey ){
        return propInfo.config.foreignKey;
    } else if (Array.isArray(propInfo.type)){
        return `${prop}Ids`;
    }
    return `${prop}Id`;
};

const _checkKey = function(idType, value){
    return idType === Number && Number.isInteger(Number(value)) === true && Number(value) > 0
        || idType === Guid && (value instanceof Guid || value.matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i))
};

const _addProp = function (prop, propInfo){
    //prop already exists
    if (Object.hasOwnProperty.call(this, prop)){
        return;
    }

    let type = propInfo.type;
    let enumerable = false;
    this._values[prop] = ref(null);
    
    if (Array.isArray(type)){
        type = type[0];
        enumerable = true;
        this._values[prop] = shallowRef([]);
    }

    //This property navigates to another model or models
    if (type.prototype instanceof Model){
        if (enumerable){
            //a collection of foreign models
            

            Object.defineProperty(this, prop, {
                enumerable: true,
                configurable: true,
                get: () => {
                    return this._values[prop];
                },
                set: (value) => {
                    //we're careful here to modify the array from Collection
                    //replacing the array would break reactivity

                    if (value === null){
                        this._values[prop].length = 0;
                    } else if (Array.isArray(value)){
                        this._values[prop].length = 0;
                        this._values[prop].push(...value);
                    }
                    this._modified = true;
                },
            });

            //ensure the model collection gets updated when the fk array does
            let foreignKey = _foreignKey.call(this, prop);
            _addProp.call(this, foreignKey, this._properties[foreignKey]);
            watch(this._values[foreignKey], () => {
                this[prop] = this[foreignKey];
            });

            //sets up this proxy collection of pointers
            //needs the foreignKey
            this._values[prop] = Collection.call(this, prop, foreignKey);

        } else {
            let foreignKey = _foreignKey.call(this, prop);

            //single foreign model
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    return Database[type.name][this[foreignKey]];
                },
                set: (value) => {
                    if (_checkKey(propInfo.type.properties.id.type, value)){
                        this._values[foreignKey].value = value;
                        this._modified = true;
                    }
                },
            });

            _addProp.call(this, foreignKey, this._properties[foreignKey]);
        }
        
        
    } else if (type instanceof Enum) {
        
        //we don't create an instance of the Enum, it's just a key-value pair we reference 
        if (enumerable){
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    if (this._values[prop].value === null) {
                        return this._values[prop].value;
                    }
                    //map the int values to their enum string equivalents
                    return this._values[prop].value.map(x => type[x]);
                },
                set: (value) => {
                    this._values[prop].value = value;
                    this._modified = true;
                }
            });
        } else {
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    //map the int value to its enum string equivalent
                    return type[this._values[prop].value];
                },
                set: (value) => {
                    this._values[prop].value = value;
                    this._modified = true;
                }
            });
        }

    } else if (type === Date) {
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop].value;
            },
            set: (value) => {
                if (value === null || value instanceof Date){
                    this._values[prop].value = value;
                } else {
                    this._values[prop].value = new Date(value);
                }
                this._modified = true;
            }
        });

    } else {
        //custom data type, create an instance
        if (type.baseType === DataType){
            this._values[prop] = new type(null, this._properties[prop].config);
        }
        //everything remaining just works with regular assignments
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop].value;
            },
            set: (value) => {
                this._values[prop].value = value;
                this._modified = true;
            }
        });
    }
}

/**
 * Converts record from API to values we use
 * @param data
 * @private
 */
 const _populate = function(data){
    if (data === undefined) {
        return;
    } 
    for (let prop in data){
        const propInfo = this._properties[prop];
        
        if (propInfo === undefined){
            console.warn(`Property ${prop} not defined on model`);
            continue;
        }

        if (propInfo.type.baseType === DataType){
            //Specialized data types need their own translation from Mantle to Crust
            //We handle this by setting the _raw value with the server output 
            this._values[prop]._raw = data[prop];

        } else if (propInfo.type.prototype instanceof Model){
            //this prop is a one-to- relationship

            if (data[prop] !== null && data[prop].length > 0){
                //if we were given data, put it in the database appropriately
                //By default, Mantle does only provides flat records, and this will 
                //never happen. However, if you wish to include deep data from Mantle,
                //you can add AutoInclude to your models or overwrite the base service methods
                Database[propInfo.type.name].add(data[prop].id, data[prop]);
            }

            //the related FK property is the source for this property

        } else if (
            Array.isArray(propInfo.type) 
            && propInfo.type[0].prototype instanceof Model
        ) {
            //this prop is a many-to- relationship

            //The related FK property is the source for this property
            if (data[prop] === null){
                continue;
            }

            //if we also got data loop through any data, put it in the database appropriately
            //This does not happen with the default Mantle setup, it only returns FKs
            for (let i = 0, l = data[prop].length; i < l; ++i){
                Database[propInfo.type[0].name].add(data[prop][i].id, data[prop][i])
            }
            
        } else {
            this[prop] = data[prop];
        }
    }
    this._modified = false;
}


class Model extends Object{
    constructor(record, config) {
        super();
        config;

        /**
         * Raw values store, the values behind the proxy
         */
        Object.defineProperty(this, '_values', {
            enumerable: false,
            configurable: true,
            writable: false,
            value: {},
        });
        
        /**
         * Populate function reference
         */
        Object.defineProperty(this, '_populate', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (data) => {
                _populate.call(this, data); 
                if (data === undefined) {
                    return;
                }
                _resolver();
            },
        });

        Object.defineProperty(this, '_refresh', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => Database[this.constructor.name].refresh(this)
            
        });
        Object.defineProperty(this, '_dto', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: this.constructor.dto
        });

         

        /**
         * Shortcut for Database.save for this record
         * @returns promise
         */
        Object.defineProperty(this, '_save', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (update = true) => Database[this.constructor.name].save(this, update)
        });

        //Remove from local records
        Object.defineProperty(this, '_remove', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => Database[this.constructor.name].remove(this)
        });

        /**
         * Shortcut for Database.delete for this record
         * @returns promise
         */
        Object.defineProperty(this, '_delete', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => Database[this.constructor.name].delete(this)
        });
        
        /**
         * Shortcut to get property type
         * @returns property type
         */
        Object.defineProperties(this, '_typeof', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (prop) => this.constructor.properties[prop].type
        });

        /**
         * Converts model values to an object for Mantle
         * @private
         */
        const _out = (types) => {
            let build = {};
            types = types || this._properties;
            for (let prop in this){
                //ignore automatic properties
                //ignore id if not present (add versus update)
                if (["created", "updated"].indexOf(prop) !== -1
                    || prop === "id" && !this[prop]){
                    continue;
                }

                let type = types[prop].type;
                if (Array.isArray(type)){
                    type = type[0];
                }

                if (type.prototype instanceof Model){
                    //TODO maybe this is a deep send, kicks off a new add if needed for nested model?
                    continue;
                }

                if (this[prop] && type && type.baseType === DataType){
                    //translate value back to something server understands
                    build[prop] = unref(this._values[prop]._raw);
                } else if(this[prop] && type && type instanceof Enum){
                    //enums need their root values, not display values
                    build[prop] = unref(this._values[prop]);
                } else {
                    //anything else should be find as-is 
                    build[prop] = unref(this[prop]);
                }
            }
            return build;
        }
        /**
         * Out function reference
         */
        Object.defineProperty(this, '_out', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: _out,
        });

        /**
         * Validate this model, or a property of this model
         */
        Object.defineProperty(this, '_validate', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: (prop = null) => {
                Validate(this, prop);
            }
        });


        /**
         * Reactive version of this model
         */
        Object.defineProperty(this, '_toReactive', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: shallowRef(this),
        });

        /**
         * Trigger reactive
         */
        Object.defineProperty(this, '_trigger', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => (triggerRef(this._toReactive))
        });

        Object.defineProperty(this, '_fetching', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: false
        });

        const _saving = ref(false) ;
        Object.defineProperty(this, '_saving', {
            enumerable: false,
            configurable: false,
            get: () => {
                return _saving.value;
            },
            set: (value) => {
                _saving.value = value;
            }
        });

        /**
         * Track errors
         */
        const _errors = reactive({});
        const _error = ref(false);
        watch(_errors, () => {
            _error.value = Object.keys(_errors).length !== 0;
        });
        
        Object.defineProperty(this, '_errors', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: _errors
        });
        Object.defineProperty(this, '_error', {
            enumerable: false,
            configurable: false,
            get: () => {
                return _error.value;
            }
        });



        const _loaded = ref(false);
        /**
         * Loaded ref
         */
        Object.defineProperty(this, '_loaded', {
            enumerable: false,
            configurable: false,
            get: () => {
                return _loaded.value;
            },
            set: (value) => {
                _loaded.value = value;
            }
        });
        
        /**
         * Loader promise
         */
        let _resolver;
        Object.defineProperty(this, '_loader', {
            enumerable: false,
            writable: false,
            value: new Promise((resolve) => {
                _resolver = resolve;
            }).then((result) => {
                _loaded.value = true;
                this._fetching = false;
                Object.keys(this._errors).forEach(key => {
                    delete this._errors[key];
                });
                return result;
            })
        });
        
        const _modified = ref(true);
        /**
         * Track if we believe record matches server
         */
        Object.defineProperty(this, '_modified', {
            enumerable: false,
            configurable: false,
            get: () => {
                return _modified.value;
            },
            set: (value) => {
                _modified.value = value;
            }
        })
        
        const _properties = this.constructor.properties;
        /**
         * Give us a static reference back to the model's properties
         */
        Object.defineProperty(this, '_properties', {
            enumerable: false,
            configurable: true,
            writable: false,
            value: _properties,
        });

        for (let prop in _properties){
            _addProp.call(this, prop, _properties[prop]);
        }
        
        this._populate(record);
    }
}

export default Model;