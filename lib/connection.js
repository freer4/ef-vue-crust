import axios from 'axios';
import {Session} from "ef-vue-crust";
import Guid from './data-types/guid';

const Connection = axios.create({
   baseURL: process.env.VUE_APP_MANTLE_URL || import.meta.env.VITE_MANTLE_URL || "/"
});

Connection.baseURL = process.env.VUE_APP_MANTLE_URL || import.meta.env.VITE_MANTLE_URL || "/";
Connection.withCredentials = true;

Connection.interceptors.request.use(
    (config) => {
        config.requestId = Guid._new();
        config.headers.common['Authorization'] = Session.token === null ? '' : `Bearer ${Session.token}`;
        requests[config.requestId] = config;
        return config; 
    }, 
    (error) => Promise.reject(error)
);

let requests = {};
window["__EF_VUE_CRUST_REQUESTS__"] = requests;

let reauthorizing = false;

Connection.interceptors.response.use(
    (response) => {
        delete requests[response.config.requestId];
        return response; 
    },
    (error) => {
        if (error.response.status === 401 && Session._isLoggedIn){
            if (reauthorizing){
                return new Promise((resolve) => {
                    setTimeout(() => {
                        error.config.headers.Authorization = `Bearer ${Session.token}`;
                        resolve(axios(error.config));
                    }, 1000);
                });
            }
            
            reauthorizing = true;
            Connection({
                method: 'post',
                url: `/Account/RefreshToken`,//TODO this all needs to be configurable
                data: {
                    refreshToken: Session.refreshToken
                }
            }).then((response) => {
                reauthorizing = false;

                Session.token = response.data.token;
                Session.refreshToken = response.data.refreshToken;

                //Add new token to previous call
                error.config.headers.Authorization = `Bearer ${Session.token}`;
                //replay previous call
                return new Promise((resolve) => {
                    resolve(axios(error.config));
                });
                

            }, (error) => {
                Session._unset();
                console.log("Token refresh failed:", error);
                window.location.reload(); //TODO configure login page
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
 * Adds a record for the model, returns promise
 * @param model
 * @param data
 * @return {*}
 */
 Connection.save = function(model, data){
    return Connection({
        method: 'post',
        url: `${model.source}/${model.endpoint || "Save"}`,
        data
    });
}
/**
 * Adds a record for the model, returns the added model
 * @param model
 * @param data
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
 * @param id
 * @return {*}
 */
 Connection.delete = function(model, id){
    return Connection({
        method: 'delete',
        url: `${model.source}/Delete/${id}`,
    });
}

export default Connection;