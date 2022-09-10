//distinguish guids
import DataType from "@/data/DataType";

class Guid extends String{
    static _out = () => {
        this.toString();
    }
    static baseType = DataType;
}
export default Guid;
