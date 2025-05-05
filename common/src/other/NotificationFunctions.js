import { firebase } from '../config/configureFirebase';
import store from '../store/store';

export const RequestPushMsg = (token, data) => {
    const {
        config
    } = firebase;
    
    const settings = store.getState().settingsdata.settings;
    let host = window && window.location && settings.CompanyWebsite === window.location.origin? window.location.origin : `https:/`
    let url = `${host}/send_notification-uv5fffc44a-uc.a.run.app`;

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "token": token,
            ...data
        })
    })
    .then((response) => {

    })
    .catch((error) => {
        console.log(error)
    });
}