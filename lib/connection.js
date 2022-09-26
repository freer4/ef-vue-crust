import axios from 'axios';
import {Session} from "ef-vue-crust";

const Connection = axios.create({
   baseURL: process.env.VUE_APP_MANTLE_URL || "/"
});

Connection.baseURL = process.env.VUE_APP_MANTLE_URL || "/";
Connection.withCredentials = true;

Connection.interceptors.request.use(
    (config) => {
        const token = Session.token;
        config.headers.common['Authorization'] = token === null ? '' : `Bearer ${token}`;
        return config; 
    }, 
    (error) => Promise.reject(error)
);

Connection.interceptors.response.use(
    (response) => {
        
        return response; 
    }, 
    (error) => {
        console.log(error.response);
        if (error.response.status === 401 && Session.isLoggedIn){
            Connection({
               method: 'post',
               url: `/Accounts/refresh-token`
            }).then((response) => {
                console.log("Refreshed token:", response);
                Session._set(response.data);
                
            }, (error) => {
                Session._unset();
                console.log("Token refresh failed:", error);
            });
        }
        
        return Promise.reject(error);
    }
);

/**
 * Get record by id for model
 * @param model
 * @param id
 * @return {Promise}
 */
Connection.get = function(model, id) {
    return Connection({
        method: 'get', 
        url: `${model.source}/Get/${id}`,
    });
}

/**
 * Gets all records for model
 * @param model
 * @return {Promise}
 */
Connection.getAll = function(model) {
    return Connection({
        method: 'get', 
        url: `${model.source}/All`,
    })
}

/**
 * 
 * @param model
 * @return {Promise}
 */
Connection.getAllIds = function(model) {
    return Connection({
        method: 'get', 
        url: `${model.source}/AllIds`,
    });
}

/**
 * Gets all records for ids list for model
 * @param model
 * @param list
 * @return {*}
 */
 Connection.list = function(model, list){
    return Connection({
        method: 'post',
        url: `${model.source}/List`,
        data: list
    });
}

/**
 * Adds a record for the model, returns the added model
 * @param model
 * @param list
 * @return {*}
 */
 Connection.save = function(model, data){
    return Connection({
        method: 'post',
        url: `${model.source}/Save`,
        data
    });
}
/**
 * Adds a record for the model, returns the added model
 * @param model
 * @param list
 * @return {*}
 */
 Connection.saveAll = function(model, data){
    return Connection({
        method: 'post',
        url: `${model.source}/SaveAll`,
        data
    });
}

/**
 * Removes a record for the model, returns bool success
 * @param model
 * @param list
 * @return {*}
 */
 Connection.delete = function(model, id){
    return Connection({
        method: 'post',
        url: `${model.source}/Delete/${id}`,
        data
    });
}

export default Connection;