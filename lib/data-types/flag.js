/**
 * A flag array, transfered from Mantle as an int, treated in Crust as an array of ints of n^2
 */
 import {reactive} from "@vue/runtime-core";
 import DataType from "ef-vue-crust/data-types/data-type";
 
 class Flag extends Array {
     /**
      * Turns an int representation of a byte array into an array of ints representative of its parts  
      * @param {int} value representation of a byte array
      * @returns {[int]} array of individual flag values
      */
     static toArray = (value) => {
         const bits = (value || 0).toString(2);
         return [...bits].reverse().map((x, i) => {
             if (x === '1'){
                 return 2**i;
             }
         }).filter(Boolean);
     }
     /**
      * Turns an array of integers into a single integer representation of a byte array
      * @param {[int]} value where int is a power of 2
      * @returns 
      */
     static toInt = (value) => {
         return value.reduce((a, b) => a + (b | 0), 0);
     }
 
     constructor(value) {
         super();
         let _value = reactive(Flag.toArray(value)); 
     
         Object.defineProperty(this, '_raw', {
             enumerable: false,
             configurable: false,
             get: () => {
                 //turn back into int
                 return Flag.toInt(_value);
             },
             set: (int) => {
                 _value = Flag.toArray(int);
             }
         });
 
         Object.defineProperty(this, 'value', {
             enumerable: false,
             configurable: false,
             get: () => {
                 return _value;
             }, 
             set: (array) => {
                 _value = array;
             }
         });
 
         Object.defineProperty(this, '_validate', {
             enumerable: false,
             configurable: false,
             writable: false,
             value: () => {
                 const errors = [];
                 return errors;
             }
         });

         return this;
     }     

     static baseType = DataType;
 }
 
 
 export default Flag;