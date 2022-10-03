/**
 * A byte array 
 */
//TODO this whole thing needs cleaned back up
import {reactive} from "@vue/runtime-core";
import DataType from "ef-vue-crust/data-types/data-type";

class ByteArray extends Array {
    static toString = (value, length = 1) => {
        return (value || 0).toString(2).padStart(length, '0');
    }
    static toArray = (value, length = 1) => {
        const bitString = ByteArray.toString(value, length);
        return [...bitString].map(x => {
            return x === '1';
        });
    }
    static toInt = (value) => {
        return parseInt(value.reduce((a, b) => a + (b | 0), ""), 2);
    }

    constructor(value, config) {
        super(value);
        let _value = reactive(ByteArray.toArray(value));

        //number of flags
        const length = config && config.maxLength ? config.maxLength : 1;
        
        Object.defineProperty(this, '_raw', {
            enumerable: false,
            configurable: false,
            get: () => {
                //output as a string
                return ByteArray.toString(this);
            },
            set: (value) => {
                //make string into bools
                _value.value = ByteArray.toArray(value, length);
            }
        });

        Object.defineProperty(this, 'value', {
            enumerable: false,
            configurable: false,
            get: () => {
                return _value.value;
            },
            set: (value) => {
                _value.value = value;
            }
        });

        return this;
    }
    
    static baseType = DataType;
}


export default ByteArray;