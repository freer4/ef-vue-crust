import DataType from "ef-vue-crust/data-types/data-type";
//Concept - image handling object TODO
//TODO convert to new DataType format
class Image{
    constructor(value) {
        Object.defineProperty(this, '_set', {
            enumerable: false,
            configurable: false,
            set: (value) => {
                Object.assign(this, value);
            }
        });
        
        this._set = value;

        Object.defineProperty(this, '_out', {
            enumerable: false,
            configurable: false,
            get: () => {
                return Object.assign({}, this);
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
    }
    static baseType = DataType;
}

export default Image;