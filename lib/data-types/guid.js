//distinguish guids
import DataType from "ef-vue-crust/data-types/data-type";

class Guid extends String{
    static _out = () => {
        this.toString();
    }
    static baseType = DataType;
}
export default Guid;
