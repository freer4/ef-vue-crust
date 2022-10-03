import {unref} from 'vue';
import DataType from "ef-vue-crust/data-types/data-type";
import Model from 'ef-vue-crust/data-types/model';

//Validate a property with its value
const _validate = (record, prop, property) => {
    
    if (["id", "created", "updated"].indexOf(prop) !== -1
        || property.type.prototype instanceof Model //TODO maybe deep validate related models?
    ){
        return;
    }

    delete record._errors[prop]; 

    let errors = [];

    //special types handle their own validation
    if (property.type.baseType === DataType){
        errors = record._values[prop]._validate();
        if (errors.length){
            record._errors[prop] = errors;    
        }
        return;
    }

    //Check required fields
    let val = unref(record._values[prop]);

    if(property.nullable === false 
        && (
            val === null 
            || val === undefined
            || property.type === String && val.trim() === ""
        )
    ){  

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