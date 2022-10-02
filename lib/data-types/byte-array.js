/**
 * A byte array, transfered from Mantle as an int, treated in Crust as 
 */
//TODO this whole thing needs cleaned back up
import {reactive} from "@vue/runtime-core";
import DataType from "ef-vue-crust/data-types/data-type";

class Flag extends Array {
    static toString = (value, length = 1) => {
        return (value || 0).toString(2).padStart(length, '0');
    }
    static toArray = (value, length = 1) => {
        const bitString = Flag.toString(value, length);
        [...bitString].map((x, i) => {
            return this[i] = x === '1';
        });

    }
    static toInt = (value) => {
        return parseInt(value.reduce((a, b) => a + (b | 0), ""), 2);
    }

    constructor(value, config) {
        super(value);
        let _value = reactive(toArray(value));
        
        Object.defineProperty(this, '_raw', {
            enumerable: false,
            configurable: false,
            get: () => {
                //turn back into int
                toInt(this);
            },
            set: (value) => {
                //number of flags
                const length = config && config.maxLength ? config.maxLength : 1;


                //make string into bools
                [...bitString].forEach((x, i) => {
                    return this[i] = x === '1';
                });
            }
        });

        Object.defineProperty(this, 'value', {
            enumerable: false,
            configurable: false,
            get: () => {
                return this;
            }
        })
        
        this._raw = value;

    }
    
    static baseType = DataType;
}


export default BitArray;