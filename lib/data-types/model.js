import {shallowRef, triggerRef, shallowReactive, watch, reactive} from "vue";
import {ref} from "@vue/reactivity";
import {Database} from "ef-vue-crust";
import DataType from "ef-vue-crust/data-types/data-type";
import Enum from "ef-vue-crust/data-types/enum";
import Guid from "ef-vue-crust/data-types/guid";
import Flag from "ef-vue-crust/data-types/flag";
import Validate from "../helpers/validator";
import Connection from "../connection";


/**
 * Array of Models that returns references to Database records when appropriate 
 */
const Collection = function(model){
    let _base = [];
    Object.defineProperty(_base, '_values', {
        enumerable: false,
        writable: true,
        value: {},
    });
    return new Proxy(_base, {
        get: (target, key) => {
            return _relatedModelGetter.call(_base, model, key)();
        },
        set: (target, key, value) => {
            _relatedModelSetter.call(_base, model, key)(value);
            //for iterators, we need the base array to have the keys
            if (_base.includes(key) === false){
                _base[key] = value;
            }
            return true;
        }
    });
}

/**
 * Takes id, returns reference to database
 * OR Takes object, turns it into model of type
 * OR Takes a model of property type and returns that
 */
const _relatedModelGetter = function (model, key){
    return () => {
        let idType = model.getProperties().id.type;

        if (
            Object.hasOwnProperty.call(this, key)
            && (
                idType === Number && Number.isInteger(Number(this._values[key])) === true && Number(this._values[key]) > 0
                || idType === Guid && this._values[key] instanceof Guid
            )
        ){
            return Database[model.name][this._values[key]];
            
        } else if (Object.hasOwnProperty.call(this._values, key)){
            return this._values[key];
            
        } else {
            return this[key];
            
        }
    }
}

const _relatedModelSetter = function (model, key, cb){ 
    return (value) => {
        let idType = model.getProperties().id.type;
        
        if (typeof value === 'object') {
            //update exising model
            if (this[key] && this[key].constructor === Model) {
                this._values[key]._populate(value);
            } else {
                this._values[key] = new model(value);
            }
            
        } else if (
            Number.isInteger(Number(key)) === true
            && (
                idType === Number && Number.isInteger(Number(value)) === true && Number(value) > 0
                || idType === Guid && value instanceof Guid
            )
        ){
            this._values[key] = value;
            
        } else {
            this[key] = value;
            
        }
        cb && cb();
        return true;
    }
}

const _foreignKey = function(prop){
    const propInfo = this.constructor.getProperties()[prop];
    if (propInfo.config && propInfo.config.foreignKey ){
        return propInfo.config.foreignKey;
    } else if (Array.isArray(propInfo.type)){
        return `${prop}Ids`;
    }
    return `${prop}Id`;
}

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
        this._values[prop] = shallowReactive([]);
    }

    //This property navigates to another model or models
    if (type.prototype instanceof Model){
        if (enumerable){
            //collection of foreign models
            //sets up this proxy collection of pointers
            this._values[prop] = Collection(type, prop);
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
                },
            });

            //ensure the model collection gets updated when the fk array does
            let foreignKey = _foreignKey.call(this, prop);
            _addProp.call(this, foreignKey, this.constructor.getProperties()[foreignKey]);
            watch(this._values[foreignKey], () => {
                this[prop] = this._values[foreignKey].value;
            });

        } else {
            //single foreign model
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: _relatedModelGetter.call(this, type, prop),
                set: _relatedModelSetter.call(this, type, prop, this._trigger),
            });
        }
        
        
    } else if (type instanceof Enum) {
        
        //enum
        const config = this.constructor.getProperties()[prop].config;
        if (config && config.flag){
            this._values[prop] = new Flag(null, this.constructor.getProperties()[prop].config);
            

            //TODO should this always be an array?
            //takes array of ints n^2 and returns enum strings
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    return this._values[prop].value.map(x => type[x]);
                },
                set: (value) => {
                    this._values[prop].value = value;
                }
            });



        //we don't create an instance of the Enum, it's just a key-value pair we reference 
        } else if (enumerable){
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    //map the int values to their enum string equivalents
                    return this._values[prop].map(x => type[x]);
                },
                set: (value) => {
                    this._values[prop] = value;
                }
            });
        } else {
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    //map the int value to its enum string equivalent
                    return type[this._values[prop]];
                },
                set: (value) => {
                    this._values[prop] = value;
                }
            });
        }

    } else if (type === Date) {
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop];
            },
            set: (value) => {
                if (value === null || value instanceof Date){
                    this._values[prop] = value;
                } else {
                    this._values[prop] = new Date(value);
                }
            }
        });

    } else {
        //custom data type, create an instance
        if (type.baseType === DataType){
            this._values[prop] = new type(null, this.constructor.getProperties()[prop].config);
        }
        //everything remaining just works with regular assignments
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop].value;
            },
            set: (value) => {
                this._values[prop].value = value;
            }
        });
    }
}


class Model extends Object{
    constructor(record, config) {
        super();
        config;


        /**
         * Raw values store, what server gives and expects
         */
        Object.defineProperty(this, '_values', {
            enumerable: false,
            configurable: true,
            writable: false,
            value: {},
        });

        
        /**
         * Converts record from API to values we use
         * @param record
         * @private
         */
        const _populate = (record) => {
            if (record === undefined) {
                return;
            } 
            for (let prop in record){
                const propInfo = this.constructor.getProperties()[prop];
                
                if (propInfo === undefined){
                    console.warn(`Property ${prop} not defined on model`);
                    continue;
                }

//                const type = propInfo.type.prototype === String ? window[Symbol.for(propInfo.type)] : propInfo.type.prototype;
                if (propInfo.type.baseType === DataType){
                    this._values[prop]._raw = record[prop];

                } else if (propInfo.type.prototype instanceof Model){
                    //this prop is a one-to- relationship


                    let foreignKey;
                    if (propInfo.config && propInfo.config.foreignKey ){
                        foreignKey = propInfo.config.foreignKey;
                    } else {
                        foreignKey = `${prop}Id`;
                    }

                    //link data by id reference
                    this._values[prop] = record[foreignKey];

                    if (record[prop] !== null){
                        //and we were given data, put it in the database appropriately
                        Database[propInfo.type.name].add(record[prop].id, record[prop]);
                    }

                } else if (
                    Array.isArray(propInfo.type) 
                    && propInfo.type[0].prototype instanceof Model
                ) {
                    //this prop is a many-to- relationship

                    let foreignKey;
                    if (propInfo.config && propInfo.config.foreignKey ){
                        foreignKey = propInfo.config.foreignKey;
                    } else {
                        foreignKey = `${prop}Ids`;
                    }

                    //link data by id reference (passes array of ids to custom setter)
                    this[prop] = record[foreignKey];

                    //if we also got data loop through any data, put it in the database appropriately
                    //This does not happen with the default Mantle setup, it only returns FKs
                    if (record[prop] === null){
                        continue;
                    }

                    for (let i = 0, l = record[prop].length; i < l; ++i){
                        Database[propInfo.type[0].name].add(record[prop][i].id, record[prop][i])
                    }
                  
                } else {
                    this[prop] = record[prop];
                }
            }
            _modified.value = false;
            _resolver();
        }
        /**
         * Populate function reference
         */
        Object.defineProperty(this, '_populate', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: _populate,
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
            value: () => {
                if (this._dto){
                    return Connection.save(this.constructor, this._out());
                }
                return Database[this.constructor.name].save(this)
            }
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
         * Converts model to an object for API
         * @private
         */
        const _out = () => {
            let build = {};
            let types = this.constructor.getProperties();
            for (let prop in this){
                //ignore automatic properties
                if (["id", "created", "updated"].indexOf(prop) !== -1){
                    continue;
                }

                let type = types[prop].type;

                if (type.prototype instanceof Model){
                    //TODO maybe this is a deep send, kicks off a new add if needed for nested model?
                    continue;
                }

                if (this[prop] && type && type.baseType === DataType){
                    build[prop] = this._values[prop]._raw;
                } else {
                    build[prop] = this[prop];
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

        const properties = this.constructor.getProperties();
        for (let prop in properties){
            _addProp.call(this, prop, properties[prop]);
        }
        
        this._populate(record);
    }
}

export default Model;