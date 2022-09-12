import {reactive, watch} from "@vue/runtime-core";
import {ref} from "@vue/reactivity";
import {shallowReactive} from "vue";
import {Connection} from "ef-vue-crust";
import Model from "ef-vue-crust/data-types/model";
import Guid from "ef-vue-crust/data-types/guid";

/**
 * An extension of Array to handle async loading information
 */
class Indexer extends Array {
    constructor(model) {
        super();

        Object.defineProperty(this, 'loaded', {
            enumerable: false,
            get: () => {
                return _loaded.value;
            }, 
            set: (value) => {
                _loaded.value = value;
            }
        });
        const _loaded = ref(false);

        Object.defineProperty(this, 'loader', {
            enumerable: false,
            writable: true,
        });

        /**
         * Returns a plain array of contained values
         */
        Object.defineProperty(this, 'toArray', {
            enumerable: false,
            writable: false,
            value: () => {
                if (this.length){
                    return [...this]
                }
                return [];
            }
        });
        
        const _reactive = reactive([]); 
        /**
         * Returns a reactive array of values
         */
        Object.defineProperty(this, 'toReactive', {
            enumerable: false, 
            writable: false,
            value: () => {
                _reactive.length = 0;
                _reactive.push(...this);
                return _reactive;
            }
        });
        watch(_loaded, () => {
            _reactive.length = 0;
            _reactive.push(...this);
        });
        

        /**
         * Chainable orderBy
         */
        Object.defineProperty(this, 'orderBy', {
            enumerable: false,
            writable: false,
            value: (prop, direction) => {
                return _database[model.name].orderBy(prop, direction, this.toArray());
            }
        });
        
        /**
         * Chainable equals
         */
        Object.defineProperty(this, 'equals', {
            enumerable: false,
            writable: false,
            value: (prop, spec) => {
                return _database[model.name].equals(prop, spec, this.toArray());
            }
        });
        
    }
}

//sorting/filtering/etc data
//!! can get smart about order, derive from other tables for cross-model sorting?
const _index = {};


//model, type, prop, spec

const index = new Proxy(_index, {
    get: (target, key) => {

        //if it's already here just return it
        if(Object.hasOwnProperty.call(target, key)){
            return target[key];
        }

        //check if we have a symbol 
        const symbol = Symbol.for(key);
        if (symbol){
            const keyModel = window[symbol];
            if (Object.isPrototypeOf.call(Model, keyModel)){

                if (Object.hasOwnProperty.call(target, keyModel.name) === false){
                    addIndexModel(keyModel);
                }

                return target[keyModel.name];
            }
        }

        console.warn(`Asked for non-model index from database: ${key}`);
        return null;
    }
});

const addIndexModel = (model) => {
    _index[model.name] = new Proxy({}, {
        get: (target, key) => {
            if (Object.hasOwnProperty.call(target, key)){
                return target[key];
            }

            addIndexType(model, key);

            return target[key];
        }
    })
};

const addIndexType = (model, typeName) => {
    _index[model.name][typeName] = new Proxy({}, {
        get: (target, key) => {
            if (Object.hasOwnProperty.call(target, key)){
                return target[key];
            }
            
            addIndexProp(model, typeName, key);

            return target[key];
        }
    })
};

const addIndexProp = (model, typeName, propName) => {
    
    _index[model.name][typeName][propName] = new Proxy({}, {
        get: (target, key) => {
            if (Object.hasOwnProperty.call(target, key)){
                return target[key];
            }

            addIndexSpec(model, typeName, propName, key);
            
            return target[key];
        },
        set: (target, key, value) => {
            target[key] = value;
            return true;
        }
    })
}

/**
 * Communicates with server when necessary to get an index of ids.
 * These are used to order/filter the larger data set without needing to download
 * all of the data for analysis. Used by and through database, not exposed externally. 
 * @param model
 * @param typeName
 * @param propName
 * @param specName
 * @returns {Indexer}
 */
const addIndexSpec = (model, typeName, propName, specName) => {
    
    let indexer = _index[model.name][typeName][propName][specName] = new Indexer(model);

    //if we're getting the ascending order and already know the descending order, 
    // we can just reverse it here
    if (
        typeName === 'order' 
        && specName === '2'
        && Object.hasOwnProperty.call(_index[model.name][typeName][propName], '1')
    ){
        indexer.push(..._index[model.name][typeName][propName]['1'].slice().reverse());
        indexer.loaded = true;
        return indexer;
    }


    //get the list of information from the server
    indexer.loader = Connection({
        type: 'get',
        url: `${model.source}/Index/${typeName}/${propName}/${specName}`
    }).then((response) => {

        indexer.length = 0;
        indexer.push(...response.data);
        indexer.loaded = true;
        
        return response;
    }, (error) => {
        indexer.loaded = true;  //!!because otherwise it keeps trying, forever.
        console.log(error);     //!!better handling
    });
    
    return indexer;
}






















//unproxied database
const _database = {};


/**
 * Adds a 'table' to the root of the _database
 * Called from database proxy property getter
 * @param {Model} model - raw Model class of desired type
 */
const addTableToDatabase = (model) => {
    

    //unproxied table
    const _table = {};
    
    //!!future implementation of guid
    const idType = model.getProperties().id.type;
    
    //Collection of all active promises
    const promiseBuffer = [];

    //Remember which ones have been loaded internally, for utility purposes
    const loadedRecords = [];

    
    
    /**
     * Filters current model or subset array by prop equal to spec.
     * Behind proxy
     * @param {string} prop - string of dot notation property path (db context, not viewmodel) //TODO Could include this information on model definition
     * @param {string} spec - specify what to match against
     * @param {array} subset - use as a shortcut, a copy of this array will be reordered
     */
     const _equals = (prop, spec, subset = false) => {
        if (!prop) {
            return new Indexer(model);
        }

        let filter = index[model.name]['equals'][prop][spec];

        if (subset === false || filter.loaded === false) {
            return filter;
        }

        let indexer = new Indexer(model);
        indexer.loaded = true;
        indexer.push(...subset.filter(x => filter.includes(x)));
        return indexer;
    }
    Object.defineProperty(_table, 'equals', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: _equals,
    });




    const _orderBy = (prop = 'id', direction = 1, subset = false) => {

        //we already know the ids, no need to ask server
        if (prop === 'id'){
            let first = direction === 1 ? 1 : -1;
            let second = direction === 1 ? -1 : 1;
            let indexer = new Indexer(model);
            indexer.loaded = true;
            indexer.push(...(subset || _table.keys).sort((x, y) => x > y ? first : second))
            return indexer;
        }

        if (subset === false){
            //the order of all of the records
            return index[model.name]['order'][prop][direction];
            
        }
        
        //the order of the subset passed in, a shorthand
        let order = index[model.name]['order'][prop][direction];
        if (order.loaded === false){
            return order;
        }
        
        let indexer = new Indexer(model);
        indexer.loaded = true;
        indexer.push(...subset.sort((x, y) => order.indexOf(x) - order.indexOf(y)));
        return indexer;
    }
    /**
     * Orders current model or subset array by property.
     * Behind proxy
     * @param {string} prop - string of dot notation property path (db context, not viewmodel) //!!Could include this information on model def
     * @param {string} direction - 1 ascending, 2 descending
     * @param {array} subset - use as a shortcut, a copy of this array will be reordered
     * and returned instead of the entire table
     * @returns {Indexer} indexer class object
     */
    Object.defineProperty(_table, 'orderBy', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: _orderBy,
    });



    /**
     * Defines reactive keys property, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, 'keys', {
        enumerable: false,
        writable: false,
        value: reactive([]),
    });

    /**
     * Gets all the ids if we haven't before, then returns the 'keys'
     * reactive property forevermore.
     * Behind proxy
     */
    Object.defineProperty(_table, 'list', {
        enumerable: false,
        configurable: true,
        get: () => {
            
            delete _table.list;
            
            let promise = Connection.getAllIds(model).then((response) => {
                for (let i in response.data){
                    addRecordToTable(response.data[i]);
                }
                promiseBuffer.splice(promiseBuffer.indexOf(promise), 1);
                return response;

            }, (error) => {
                console.log(error);
               //!!error handling 
            });
            promiseBuffer.push(promise);
            console.log(promiseBuffer, promise);
            
            Object.defineProperty(_table, 'list', {
                enumerable: false,
                configurable: false,
                get: () => {
                    return _table.keys;
                }
            });
            
            return _table.list;
        }
    });

    /**
     * Downloads all available data from server to browser. USE. SPARINGLY.
     * @returns Promise;
     */
    Object.defineProperty(_table, 'all', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: () => {
            return Connection.getAll(model).then((response) => {
                for (let i in response.data){
                    addRecordToTable(response.data[i].id, response.data[i]);
                }
                return response;
            });
            //!! Error handling
        }
    });

    /**
     * Downloads the passed subset of data from server to browser.
     * @param {array} subset - array of ids to load now 
     * @returns Promise; 
     */
    Object.defineProperty(_table, 'load', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (subset) => {
            for (let i in subset){
                let id = subset[i];
                
                //in case we haven't seen this yet
                addRecordToTable(id);
                
                //don't bother if we're getting it already
                if (_table[id]._fetching || _table[id]._error){
                    continue;
                }
                _table[id]._fetching = true;
                buffer.push(id);
            }
            //no wait, fetch now.
            fetchRecords();
            return _table.loader;
        }
    });
    
    const _array = reactive([]);
    /**
     * Reactive array version of this table. 
     */
    Object.defineProperty(_table, 'array', {
        enumerable: false,
        configurable: false,
        get: () => {
            return _array;
        }
    });

    /**
     * Defines ref length property, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, 'length', {
        enumerable: false,
        writable: false,
        value: ref(0),
    });

    /**
     * Defines ref loaded property, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, 'loaded', {
        enumerable: false,
        writable: false,
        value: ref(false),
    });

    /**
     * Defines loader for all open promises, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, 'loader', {
        enumerable: false,
        get: () => {
            return Promise.all(promiseBuffer);
        },
    });
    
    /**
     * Defines returns promises array, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, 'promises', {
        enumerable: false,
        get: () => {
            return promiseBuffer;
        },
    });

    var trackLoaded = ref(0);
    
    watch([trackLoaded, _table.length], () => {
       _table.loaded.value = trackLoaded.value === _table.length.value;
    });
    
    /**
     * Adds a 'record' to the 'table'
     * Behind proxy
     * @param id
     * @param data 
     */
    const addRecordToTable = (id, data) => {
        //if we have data, don't set up lazy loading
        if (data){
            let wasLoaded = _table[id] && _table[id]._loaded; 
            if (Object.hasOwnProperty.call(_table, id) === false){
                _table[id] = new model();
                _table.length.value++;
                _array.push(_table[id]);
                _table.keys.push(id);
            }
            _table[id]._populate(data);
            if (wasLoaded === false){
                trackLoaded.value++;
                loadedRecords.push(id);
            }
            return;
        }
        
        //let this function determine if the record needs added
        if (Object.hasOwnProperty.call(_table, id)){
            return;
        }
        
        //sets up a lazy load for the next time this record is accessed
        Object.defineProperty(_table, id, {
            enumerable: true,
            configurable: true,
            get: () => {
                
                //we don't need this definition any more
                delete _table[id]; 
                
                //set up empty model, with id set
                _table[id] = new model();
                _table[id].id = id;
                _array.push(_table[id]);

                _table[id]._loader.then((response) => {
                    //track that a record has loaded
                    trackLoaded.value++;
                    loadedRecords.push(id);
                    return response;
                });//!! error handling? 
                
                //set the record to get fetched
                queueRecordRequests(id);
                return _table[id];//!!maybe should be proxy? Might cause instant recursion? 
            }
        })

        //track that we've added a record to the table
        _table.length.value++;

        //make reactive keys aware of our new record
        _table.keys.push(id);

    };
    
    /**
     * Adds record directly to the table
     * @returns Promise;
     */
     Object.defineProperty(_table, 'add', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: addRecordToTable
    });
    
    let waiter = null;
    const buffer = [];
    
    /**
     * Queues ID for fetching.
     * Behind proxy
     * @param id
     */
    const queueRecordRequests = (id) => {
        
        //already getting this one, or there was an error don't try automatically
        if (_table[id]._fetching || _table[id]._error){
            return;
        }
        
        clearTimeout(waiter);
        _table[id]._fetching = true;
        buffer.push(id);
        waiter = setTimeout(fetchRecords, 50);
    }

    /**
     * Fetches lists of data for this table.
     * Behind proxy
     */
    const fetchRecords = () => {
        const requestBuffer = [...buffer];
        buffer.length = 0;
        
        let promise = Connection.list(model, requestBuffer).then((response) => {
            
            //set all the data we got back
            for (let i in response.data){
                _table[response.data[i].id]._populate(response.data[i]);
                requestBuffer.splice(requestBuffer.indexOf(response.data[i].id), 1);
            }
            
            //if we didn't get some back mark them with an error
            for (let i in requestBuffer){
                console.warn(`Id ${requestBuffer[i]} on ${model.name} was omitted from return.`);
                _table[requestBuffer[i]]._error = 'Could not retrieve';
            }
            promiseBuffer.splice(promiseBuffer.indexOf(promise), 1);

        }, (error) => {
            //mark all records in this buffer with error
            for (let i in requestBuffer){
                _table[requestBuffer[i]]._error = error;
            }
            console.log(error);//!!be smarter
        });
        promiseBuffer.push(promise);
    }

    
    
    //Set up the proxy to the new table on the database
    _database[model.name] = shallowReactive(new Proxy(_table, {
        get: (target, key) => {
            
            //any records or helpers just get returned
            if (Object.hasOwnProperty.call(target, key)){
                return target[key];
            }

            //any new records need to have the correct type of id
            if (
                key.constructor === Symbol
                || idType === Number && (Number.isInteger(Number(key)) === false || Number(key) <= 0)
                || idType === Guid && !(key instanceof Guid)
            ) {
                //console.warn(`Asked for mistyped record id: ${key}`);
                return null;
            }
            
            //non-existent id gets a new model
            addRecordToTable(key);
            return target[key];
        }, 
        
        //readies the record - the data can only be fetched internally
        set: (target, key) => {
            if (idType === Number && (Number.isInteger(Number(key)) === false || Number(key) <= 0)){
                console.warn(`Tried to add mistyped record id: ${key}`);
                return false;
            }
            if (Object.hasOwnProperty.call(target, key) === false){
                addRecordToTable(key);
            }
            return true;                            
        }
    }));
}




const Database = new Proxy(_database, {
   get: (target, key) => {
       
       //if it's already here just return it
       if(Object.hasOwnProperty.call(target, key)){
           return target[key];
       }

       //check if we have a symbol 
       const symbol = Symbol.for(key);
       if (symbol){
           const keyModel = window[symbol];
           if (Object.isPrototypeOf.call(Model, keyModel)){
               
               if (Object.hasOwnProperty.call(target, keyModel.name) === false){
                   addTableToDatabase(keyModel);
               }

               return target[keyModel.name];
           }
       }

       console.warn(`Asked for non-model record from database: ${key}`);
       return null;
       
   } 
});


export default Database;