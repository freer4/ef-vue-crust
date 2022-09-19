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
        
        Object.defineProperty(this, '_validate', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: () => {
                const errors = [];
                
                if (this.latitude && this.longitude){
                    return;
                } else {
                    if (!this.latitude){
                        errors.push({
                            type: 'required',
                            subtype: 'latitude',
                            message: '{fieldName} is required.',
                        });
                    } 
                    if (!this.longitude){
                        errors.push({
                            type: 'required',
                            subtype: 'longitude',
                            message: '{fieldName} is required.',
                        });
                    }
                }

                return error;
            }
        });
    }
    static baseType = DataType;
}

export default Point;