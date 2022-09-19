import {isProxy} from 'vue';
import DataType from "ef-vue-crust/data-types/data-type";

//Validate a property with its value
const _validate = (record, prop, property) => {
    delete record._errors[prop]; 

    const errors = [];

    //special types handle their own validation
    if (property.type.baseType === DataType){
        errors = record[prop]._validate();
        if (errors.length){
            record._errors[prop] = errors;    
        }
        return;
    }

    //Check required fields
    let val = record._values[prop];
    if (isProxy(val)){
        val = val.value;
    }
    if(property.nullable === false && (
        val === null 
        || val === undefined
        || property.type === String && val.trim() === ""
    )){

        errors.push({
            type: 'required',
            message: '{fieldName} is required.'
        })  
    }

    if (errors.length){
        record._errors[prop] = errors;    
    }
}

//Take the model instance, loop over all the properties
const Validate = (record, prop = null) => {
    const properties = record.constructor.getProperties();

    //overload for validating just one prop
    if (prop !== null){
        _validate(record, prop, properties[prop]);
        return;
    }

    //go through every property, checking each
    for (let name in properties){
        _validate(record, name, properties[name]);
    }
}

export default Validate;