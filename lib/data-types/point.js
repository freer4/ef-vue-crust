import DataType from "ef-vue-crust/data-types/data-type";

class Point{
    constructor(value) {
        Object.defineProperty(this, '_set', {
            enumerable: false,
            configurable: false,
            set: (value) => {
                Object.assign(this, value);
            }
        });
        
        this._set = value;
        // this.latitude = value.latitude;
        // this.longitude = value.longitude;

        //turn back into int 
        Object.defineProperty(this, '_out', {
            enumerable: false,
            configurable: false,
            get: () => {
                return Object.assign({}, this);
            }
        });
        
    }
    static baseType = DataType;
}

export default Point;