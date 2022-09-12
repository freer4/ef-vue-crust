import {reactive} from "@vue/runtime-core";

const Session = reactive({});
const browserSession = window.sessionStorage;

Session.set = (auth) => {
    Session.isLoggedIn = true;
    Session.token = auth.jwtToken;
    Session.displayName = auth.displayName;
    Session.settings = auth.settings;
    Session.email = auth.email;
    Session.userId = auth.id;
    browserSession.setItem('auth', JSON.stringify(auth));
};
Session.unset = () => {
    Session.isLoggedIn = false;
    Session.token = '';
    Session.displayName = '';
    Session.settings = '';
    Session.email = '';
    Session.userId = '';
    browserSession.removeItem('auth');
}

const knownSession = browserSession.getItem('auth');
if (knownSession){
    Session.set(JSON.parse(knownSession));
}

export default Session;