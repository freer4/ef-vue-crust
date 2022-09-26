import {reactive, ref} from "@vue/runtime-core";

const _session = {token: null};
const browserSession = window.sessionStorage;


//logged in bool, controlled by _set/_unset
const isLoggedIn = ref(false);
Object.defineProperty(_session, '_isLoggedIn', {
    enumerable: false,
    configurable: false,
    get: () => {
        return isLoggedIn.value;
    }
});

//Set anything we want on the session
//token is required for logged in status
Object.defineProperty(_session, '_set', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: (session) => {
        for(let key in session){
            Session[key] = session[key];
        }
        if(Session.token !== null){
            isLoggedIn.value = true;
        }
        browserSession.setItem('Session', JSON.stringify(Session));    
    }
});

//Clear out the Session values
Object.defineProperty(_session, '_unset', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: () => {
        for (let key in Session){
            if (key === 'token'){
                continue;
            }
            delete Session[key];
        }
        isLoggedIn.value = false;
        Session.token = null;
        browserSession.removeItem('Session');
    }
});

const Session = reactive(_session);

//Find and load session information from browser (so refreshes don't wipe out the logged in state)
const knownSession = browserSession.getItem('Session');
if (knownSession){
    Session._set(JSON.parse(knownSession));
}

export default Session;