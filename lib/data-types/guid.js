//distinguish guids
import DataType from "ef-vue-crust/data-types/data-type";

//TODO convert to new DataType format
class Guid extends String{
    constructor(value){
        if (value === undefined){
            value = self.crypto.randomUUID();
        }

    }
    static _out = () => {
        this.toString();
    }
    static baseType = DataType;
}
export default Guid;
