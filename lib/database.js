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

        Object.defineProperty(this, '_loaded', {
            enumerable: false,
            get: () => {
                return _loaded.value;
            }, 
            set: (value) => {
                _loaded.value = value;
            }
        });
        const _loaded = ref(false);

        Object.defineProperty(this, '_loader', {
            enumerable: false,
            writable: true,
        });

        /**
         * Returns a plain array of contained values
         */
        Object.defineProperty(this, '_keys', {
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
        Object.defineProperty(this, '_list', {
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
        
        Object.defineProperty(this, '_array', {
            enumerable: false,
            writable: false,
            value: () => {
                const records = [];
                this.forEach(x => {
                    records.push(Database[model.name][x]);
                });
                return reactive(records);
            }
        });

        /**
         * Chainable orderBy
         */
        Object.defineProperty(this, '_orderBy', {
            enumerable: false,
            writable: false,
            value: (prop, direction) => {
                return _database[model.name]._orderBy(prop, direction, this._keys());
            }
        });
        
        /**
         * Chainable equals
         */
         Object.defineProperty(this, '_equals', {
            enumerable: false,
            writable: false,
            value: (prop, spec) => {
                return _database[model.name]._equals(prop, spec, this._keys());
            }
        });

        /**
         * Chainable contains
         */
        Object.defineProperty(this, '_contains', {
            enumerable: false,
            writable: false,
            value: (prop, spec) => {
                return _database[model.name]._contains(prop, spec, this._keys());
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

    //TODO something in this logic breaks sorting?
    //if we're getting the ascending order and already know the descending order, 
    // we can just reverse it here
    // if (
    //     typeName === 'order' 
    //     && specName === '2'
    //     && Object.hasOwnProperty.call(_index[model.name][typeName][propName], '1')
    // ){
    //     indexer.push(..._index[model.name][typeName][propName]['1'].slice().reverse());
    //     indexer._loader = new Promise((resolve) => { indexer._loaded = true; resolve(); });
    //     return indexer;
    // }
    // if (
    //     typeName === 'order' 
    //     && specName === '1'
    //     && Object.hasOwnProperty.call(_index[model.name][typeName][propName], '2')
    // ){
    //     indexer.push(..._index[model.name][typeName][propName]['2'].slice().reverse());
    //     indexer._loader = new Promise((resolve) => { indexer._loaded = true; resolve(); });
    //     return indexer;
    // }


    //get the list of information from the server
    indexer._loader = Connection({
        type: 'get',
        url: `${model.source}/Index/${typeName}/${propName}/${specName}`
    }).then((response) => {

        indexer.length = 0;
        indexer.push(...response.data);
        indexer._loaded = true;
        
        return response;
    }, (error) => {
        indexer._loaded = true;  //TODO because otherwise it keeps trying, forever.
        console.log(error);     //TODO better handling
    });
    
    return indexer;
}














//Search and sort methods

/**
 * Filters current model or subset array by prop equal to spec.
 * Behind proxy
 * @param {string} prop - string of dot notation property path (db context, not viewmodel) //TODO Could include this information on model definition
 * @param {string} spec - specify what to match against
 * @param {array} subset - use as a shortcut, a copy of this array will be reordered
 */
const _equals = function(prop, spec, subset = false) {
    if (!prop) {
        return new Indexer(this);
    }

    //fetches or creates index
    let filter = index[this.name]['equals'][prop][spec];

    if (subset === false || filter._loaded === false) {
        return filter;
    }

    let indexer = new Indexer(this);
    indexer._loaded = true;
    indexer.push(...subset.filter(x => filter.includes(x)));
    return indexer;
}

const _contains = function(prop, spec, subset = false) {
    if (!prop){
        return new Indexer(this);
    }

    let filter = index[this.name]['contains'][prop][spec];
    
    if (subset === false || filter._loaded === false) {
        return filter;
    }
    
    let indexer = new Indexer(this);
    indexer._loaded = true;
    indexer.push(...subset.filter(x => filter.includes(x)));
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
const _orderBy = function(prop = 'id', direction = 1, subset = false) {

    //we already know the ids, no need to ask Mantle
    if (prop === 'id'){
        let first = direction === 1 ? 1 : -1;
        let second = direction === 1 ? -1 : 1;
        let indexer = new Indexer(this);
        indexer._loaded = true;
        indexer.push(...(subset || Database[this.name]._keys).sort((x, y) => x > y ? first : second))
        return indexer;
    }

    if (subset === false){
        //the order of all of the records
        return index[this.name]['order'][prop][direction];
        
    }
    
    //the order of the subset passed in, a shorthand
    let order = index[this.name]['order'][prop][direction];
    if (order._loaded === false){
        return order;
    }
    
    let indexer = new Indexer(this);
    indexer._loaded = true;
    indexer._loader = order._loader;
    indexer.push(...subset.sort((x, y) => order.indexOf(x) - order.indexOf(y)));
    return indexer;
}


//unproxied database holder
const _database = {};


/**
 * Adds a 'table' to the root of the _database
 * Called from database proxy property getter
 * @param {Model} model - raw Model class of desired type
 */
const addTableToDatabase = (model) => {
    

    //unproxied table holder
    const _table = {};
    
    //track which id type we're using (Number, Guid)
    const idType = model.properties.id.type;
    
    //Collection of all active promises for this table
    const promiseBuffer = [];
   
    
    Object.defineProperty(_table, '_equals', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (prop, spec, subset) => _equals.call(model, prop, spec, subset),
    });
    
    Object.defineProperty(_table, '_contains', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (prop, spec, subset) => _contains.call(model, prop, spec, subset),
    });

    Object.defineProperty(_table, '_orderBy', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (prop, spec, subset) => _orderBy.call(model, prop, spec, subset),
    });

    /**
     * Returns an Indexer object of the current model, useful for starting chains such as loops
     */
    Object.defineProperty(_table, '_toIndexer', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: () => { 
            const indexer = new Indexer(model);
            indexer.push(..._table._list);
            return indexer;
        },
    });

    /**
     * Defines reactive keys property, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, '_keys', {
        enumerable: false,
        writable: false,
        value: reactive([]),
    });

    /**
     * Gets all the ids if we haven't before, then returns the 'keys'
     * reactive property forevermore.
     * Behind proxy
     */
    Object.defineProperty(_table, '_list', {
        enumerable: false,
        configurable: true,
        get: () => {

            //after the first call to this property, we don't need this functionality anymore
            delete _table._list;
            
            //grab all ids from Mantle
            let promise = Connection.getAllIds(model).then((response) => {

                //add an empty model to the table for each returned id
                for (let i in response.data){
                    addRecordToTable(response.data[i]);
                }
                //remove this promise from the buffer
                promiseBuffer.splice(promiseBuffer.indexOf(promise), 1);
                return response;

            }, (error) => {
                console.log(error);
               //!!error handling 
            });

            //add the Mantle call to the buffer
            promiseBuffer.push(promise);
            
            //redefine the _list property to forevermore return the _keys property
            Object.defineProperty(_table, '_list', {
                enumerable: false,
                configurable: false,
                get: () => {
                    return _table._keys;
                }
            });
            
            return _table._list;
        }
    });

    /**
     * Asks for all the Ids again, and then adds/removes as needed
     * @returns promise
     */
    Object.defineProperty(_table, '_refreshList', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: () => {
            const promise = Connection.getAllIds(model).then((response) => {

                //try to add each model to the talbe, method handles existing data internally
                for (let i in response.data){
                    addRecordToTable(response.data[i]);
                }
                const tableKeys = Object.keys(_table) 
                for (let i in tableKeys){
                    //TODO GUID needs a conditional
                    if (response.data.indexOf(parseInt(tableKeys[i])) === -1){
                        removeRecordFromTable(response.data[i]);
                    }
                }

                promiseBuffer.splice(promiseBuffer.indexOf(promise), 1);//TODO custom add/remove on promise buffer? auto when resolved?
                return response;

            });//TODO error handling
            promiseBuffer.push(promise);
            return promise;
        }
    });
    
    /**
     * Explicitly asks for this record from Mantle (overrides local data)
     * @param id The id of the record to refresh (or local model thereof)
     * @returns promise 
     */
    Object.defineProperty(_table, '_refresh', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (id) => {
            if(id.constructor == model){
                id = id.id;
            }

            const promise = Connection.get(model, id).then((response) => {
                addRecordToTable(response.data.id, response.data);
                promiseBuffer.splice(promiseBuffer.indexOf(promise), 1);
                return response;
            });

            promiseBuffer.push(promise);
            return promise;
        }
    });



    /**
     * Downloads all available data from server to browser. USE. SPARINGLY.
     * @returns Promise;
     */
    Object.defineProperty(_table, '_all', {
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
     * @param {null, [Id]} subset - array of ids to load now. leave empty to load all local records not yet loaded
     * @returns Promise; 
     */
    Object.defineProperty(_table, '_load', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (subset = null) => {
            if (subset === null){
                for (let i in _array){
                    if (_array[i]._loaded === false){
                        requestBuffer.push(_array[i].id);
                    }
                }
            } else {
                for (let i in subset){
                    let id = subset[i];
                    
                    //in case we haven't seen this yet
                    addRecordToTable(id);
                    
                    //don't bother if we're getting it already
                    if (_table[id]._fetching || _table[id]._error){
                        continue;
                    }
                    _table[id]._fetching = true;
                    requestBuffer.push(id);
                }    
            }

            //no wait, fetch now.
            fetchRecords();
            return _table._loader;
        }
    });
    
    const _array = reactive([]);
    /**
     * Reactive array version of this table. 
     */
    Object.defineProperty(_table, '_array', {
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
    Object.defineProperty(_table, '_length', {
        enumerable: false,
        writable: false,
        value: ref(0),
    });

    /**
     * Defines ref loaded property, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, '_loaded', {
        enumerable: false,
        writable: false,
        value: ref(false),
    });

    /**
     * Defines loader for all open promises, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, '_loader', {
        enumerable: false,
        get: () => {
            return Promise.all(promiseBuffer);
        },
    });
    
    /**
     * Defines returns promises array, read-only.
     * Behind proxy
     */
    Object.defineProperty(_table, '_promises', {
        enumerable: false,
        get: () => {
            return promiseBuffer;
        },
    });

    //How many records have been loaded from Mantle
    var trackLoaded = ref(0);

    //if we change the number we know have loaded or the number of records in table, updated loaded flag
    watch([trackLoaded, _table._length], () => {
       _table._loaded.value = trackLoaded.value === _table._length.value;
    });
    




    /// BEGIN ADD/REMOVE RECORD(S) ///


    /**
     * Adds a 'record' to the 'table'
     * Behind proxy
     * @param id
     * @param data (optional) 
     * @returns local database table proxy
     */
    const addRecordToTable = (id, data) => {

        //if we have data, don't set up lazy loading, populate record now
        if (data){

            let wasLoaded = _table[id] && _table[id]._loaded; 

            //if record doesn't exist locally, set it up
            if (Object.hasOwnProperty.call(_table, id) === false){
                _table[id] = new model();
                _table._length.value++;
                _array.push(_table[id]);
                _table._keys.push(id);
            }

            //populate it with data
            _table[id]._populate(data);
            
            //track it has been loaded
            if (wasLoaded === false){
                trackLoaded.value++;
            }

            return _database[model.name];
        }
        
        //let this function determine if the record needs added
        if (Object.hasOwnProperty.call(_table, id)){
            return _database[model.name];
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
                    return response;
                });//!! error handling? 
                
                //set the record to get fetched
                queueRecordRequests(id);
                return _table[id];//!!maybe should be proxy? Might cause instant recursion? 
            }
        })

        //track that we've added a record to the table
        _table._length.value++;

        //make reactive keys aware of our new record
        _table._keys.push(id);

        //can't return record because access triggers data pull
        return _database[model.name];

    };
    
    /**
     * Removes record from local database table
     * @param {Id, Record} id Takes a record or a record id
     * @returns {boolean} returns success 
     */
     const removeRecordFromTable = (id) => {
        try {
            if(id.constructor == model){
                id = id.id;
            }

            //track that we've removed a record from the table
            _table._length.value--;

            //make reactive keys aware of record delete
            const keyIndex = _table._keys.indexOf(id);
            if (keyIndex !== -1) {
                _table._keys.splice(keyIndex, 1);
            }

            //make reactive array aware of record delete
            const arrayIndex = _array.indexOf(_table[id])
            if (arrayIndex !== -1){
                _array.splice(arrayIndex, 1);
            }

            //delete the record
            delete _table[id];

        } catch (e){
            console.warn(e);
            return false;
        }
        return true;
    };



    /**
     * Sends data for a record to Mantle
     * @param {Id, Record} id id or record 
     * @returns {Promise}
     */
     Object.defineProperty(_table, '_save', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (id, update = true) => {

            //TODO store the data in local storage... auto retry? 
            let record; 
            let data;
            try {
                record = id.constructor === model ? id : _table[id];
                data = record._out();
            } catch (e){
                return Promise.reject(e);
            }

            record._saving = true;
            //send data up to Mantle
            return Connection.save(model, data).then((response) => {
                    
                //If good, we should receive the fresh data with and can add/update directly to the local records
                if (update){
                    addRecordToTable(response.data.id, response.data);
                }
                record._saving = false;
                return response;

            });//TODO error handling
        }
    });

    /**
     * Sends all modified records to Mantle
     * @param {null, [Id], [Record]} ids no parameter saves all modified records. Array of ids/records saves those records 
     * @returns {Promise}
     */
    Object.defineProperty(_table, '_saveAll', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (ids = null) => {
            const buildSaves = [];

            try {
                if (ids === null){
                    _array.forEach(x => {
                        if (x._modified) {
                            buildSaves.push(x._out())
                        }
                    });    
                } else {
                    for (let i = 0, l = ids.length; i < l; ++i){
                        buildSaves.push(ids[i].constructor === model ? ids[i]._out() : _table[ids[i]]);
                    }
                }
            } catch (e){
                return Promise.reject(e);
            }

            return Connection.saveAll(model, buildSaves).then((response) => {
                for(var i = 0, l = response.data.length; i < l; ++i ){
                    addRecordToTable(response.data[i].id, response.data[i]);
                    return response;
                }
            });
        }
    });
    
    /**
     * Adds record for the table (not sent to Mantle)
     * @returns false or Promise;
     */
     Object.defineProperty(_table, '_add', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: addRecordToTable
    });
    

    /**
     * Asks Mantle to delete a record
     * @param {Id, Record} id the id or the record to delete
     * @returns {Promise} 
     */
    Object.defineProperty(_table, '_delete', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: (id) => {
            if (id.constructor === model){
                id = id.id;
            }
            return Connection.delete(model, id).then((response) => {
                removeRecordFromTable(id);
                return response;
            });//TODO error handling
        }

    });



    Object.defineProperty(_table, '_remove', {
        enumerable: false,
        configurable: false,
        writable: false, 
        value: removeRecordFromTable
    });


    /// END ADD/REMOVE RECORD(S) ///

    



    let waiter = null;
    const requestBuffer = [];
    
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
        requestBuffer.push(id);
        waiter = setTimeout(fetchRecords, 50);
    }

    /**
     * Fetches lists of data for this table.
     * Behind proxy
     */
    const fetchRecords = () => {
        const runBuffer = [...requestBuffer];
        requestBuffer.length = 0;
        
        let promise = Connection.list(model, runBuffer).then((response) => {
            
            //set all the data we got back
            for (let i in response.data){

                //TODO reexamine how this would disappear between asking and receiving info
                if (_table[response.data[i].id]){
                    _table[response.data[i].id]._populate(response.data[i]);
                }
                runBuffer.splice(runBuffer.indexOf(response.data[i].id), 1);
            }
            
            //if we didn't get some back mark them with an error
            for (let i in runBuffer){
                console.warn(`Id ${runBuffer[i]} on ${model.name} was omitted from return.`);

                _table[runBuffer[i]]._errors._model = {
                    type: 'missing',
                    message: `Id ${runBuffer[i]} on ${model.name} was omitted from return.`
                };
            }
            promiseBuffer.splice(promiseBuffer.indexOf(promise), 1);

        }, (error) => {
            //mark all records in this buffer with error
            for (let i in runBuffer){
                _table[runBuffer[i]]._errors._model = {
                    type: 'request',
                    message: error
                };
            }
            console.log(error);//!TODO be smarter about error
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
                || idType === Guid && !(Guid._validate(key))
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