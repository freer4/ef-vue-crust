/**
 * A byte array
 */
import {reactive} from "@vue/runtime-core";
import DataType from "ef-vue-crust/data-types/data-type";

class BitArray extends Array {
    constructor(value, config) {
        super();
        
        Object.defineProperty(this, '_set', {
            enumerable: false,
            configurable: false,
            set: (value) => {
                //number of flags
                const length = config && config.maxLength ? config.maxLength : 1;

                //int value to binary string representation
                const bitString = (value || 0).toString(2).padStart(length, '0');

                //make string into bools
                [...bitString].forEach((x, i) => {
                    return this[i] = x === '1';
                });                
            }
        });
        
        this._set = value;

        //turn back into int
        Object.defineProperty(this, '_out', {
            enumerable: false,
            configurable: false,
            get: () => {
                return parseInt(this.reduce((a, b) => a + (b | 0), ""), 2);
            }
        });
        
        return reactive(this);
    }
    
    static baseType = DataType;
}


export default BitArray;