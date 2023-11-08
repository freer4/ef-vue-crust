import DataType from "ef-vue-crust/data-types/data-type";
class Point{
    constructor(value) {
        
        this.latitude = null;
        this.longitude = null;
        
        Object.defineProperty(this, '_raw', {
            enumerable: false,
            configurable: false,
            get: () => {
                return Object.assign({}, this);
            },
            set: (value) => {
                if (value === null){
                    for(const key of Object.keys(this)){
                        this[key] = null;
                    } 
                    return;
                }
                Object.assign(this, value);
            }
        });
        
        Object.defineProperty(this, 'value', {
            enumerable: false,
            configurable: false,
            get: () => {
                return this;
            }, 
            set: (value) => {
                this._raw = value;
            }
        });

        this._raw = value;
        
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

                return errors;
            }
        });
    }
    static baseType = DataType;
}

export default Point;
