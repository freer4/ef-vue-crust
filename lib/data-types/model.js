import {shallowRef, triggerRef, shallowReactive} from "vue";
import {ref} from "@vue/reactivity";
import {Database} from "ef-vue-crust";
import DataType from "ef-vue-crust/data-types/data-type";
import Enum from "ef-vue-crust/data-types/enum";
import Guid from "ef-vue-crust/data-types/guid";


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

const _addProp = function (prop, options){
    let type = options.type;
    let enumerable = false;
    this._values[prop] = ref(null);
    
    if (Array.isArray(type)){
        type = type[0];
        enumerable = true;
        this._values[prop] = shallowReactive([]);
        
    }

    if (type.prototype instanceof Model){
        if (enumerable){
            this._values[prop] = Collection(type, prop);
            Object.defineProperty(this, prop, {
                enumerable: true,
                configurable: true,
                get: () => {
                    return this._values[prop];
                },
                set: (value) => {
                    if (value === null){
                        this._values[prop].length = 0;
                    } else if (Array.isArray(value)){
                        this._values[prop].length = 0;
                        this._values[prop].push(...value);
                    }
                },
            });
        } else {
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: _relatedModelGetter.call(this, type, prop),
                set: _relatedModelSetter.call(this, type, prop, this._trigger),
            });
        }
        
    } else if (type.baseType === DataType) {
        this._values[prop] = new type(null, this.constructor.getProperties()[prop].config);
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop];
            },
            set: (value) => {
                this._values[prop]._set = value;
            }
        });

    } else if (type.prototype === Enum) {
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop];
            },
            set: (value) => {
                this._values[prop] = value;
            }
        });

    } else if (type === Date) {
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop];
            },
            set: (value) => {
                if (value instanceof Date){
                    this._values[prop] = value;
                } else {
                    this._values[prop] = new Date(value);
                }
            }
        });

    } else {
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
                    //instance of special data types
                    this[prop] = record[prop];

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
                    
                    for (let i = 0, l = record[prop].length; i < l; ++i){
                        //loop through any data, put it in the database appropriately
                        Database[propInfo.type[0].name].add(record[prop][i].id, record[prop][i])
                    }
                  
                } else {
                    this[prop] = record[prop];
                }
            }
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


        /**
         * Converts model to an object for API
         * @private
         */
        const _out = () => {
            let build = {};
            for (let prop in this){
                console.log(prop, this.constructor.getProperties());
                let type = this.constructor.getProperties()[prop].type;

                if (this[prop] && type && type.baseType === DataType){
                    build[prop] = this[prop]._out;
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
            value: () => (triggerRef(this._toReactive)),
        });

        Object.defineProperty(this, '_fetching', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: false,
        });

        Object.defineProperty(this, '_error', {
            enumerable: false,
            configurable: false,
            writable: true,
            value: false,
        });
        
        const _loaded = ref(false);
        /**
         * Loaded ref
         */
        Object.defineProperty(this, '_loaded', {
            enumerable: false,
            configurable: false,
            set: (value) => {
                _loaded.value = value;
            },
            get: () => {
                return _loaded.value;
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
                this._error = false;
                return result;
            })
        });
        
        for (let prop in this.constructor.getProperties()){
            _addProp.call(this, prop, this.constructor.getProperties()[prop]);
        }
        
        this._populate(record);
    }
}

export default Model;