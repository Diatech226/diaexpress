/*eslint no-loop-func: "off"*/
const { onValueCreated, onValueDeleted, onValueUpdated } = require('firebase-functions/v2/database');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const rgf = require('regularusedfunctions');
const RequestPushMsg = require('./common').RequestPushMsg;
const addToWallet = require('./common').addToWallet;
const deductFromWallet = require('./common').deductFromWallet;
const getDistance = require('./common').getDistance;
const config = require('./config.json');
const addEstimate = require('./common/sharedFunctions').addEstimate;
const translate = require('@iamtraction/google-translate');
const appcat = require('./appcat.js');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');
const functions = require("firebase-functions/v2");
const {setGlobalOptions} = require("firebase-functions/v2");

admin.initializeApp();

const databaseURL = admin.app().options.databaseURL;

setGlobalOptions({ region: databaseURL.split('.').length===4?databaseURL.split('.')[1]:'us-central1'});

var methods = [
    "braintree",
    "culqi",
    "flutterwave",
    "liqpay",
    "mercadopago",
    "payfast",
    "paypal",   
    "paystack",
    "paytm",
    "payulatam",
    "securepay",
    "stripe",
    "squareup",
    "wipay",
    "razorpay",
    "paymongo",
    "iyzico",
    "slickpay",
    "test",
    "xendit",
     "tap"
];

for (let i = 0; i < methods.length; i++) {
    exports[methods[i]] = require(`./providers/${methods[i]}`);
}

exports.get_providers = onRequest(async(request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    const db = getDatabase()
    db.ref('/payment_settings').once("value", (psettings) => {
        if(psettings.val()){
            let arr = [];
            let obj = psettings.val();
            let pms = Object.keys(obj);
            for(let i=0; i < pms.length; i++){
                if(obj[pms[i]].active){
                    arr.push({
                        name: pms[i],
                        link: '/' + pms[i] + '-link'
                    })
                }
            }
            response.send(arr);
        }else{
            response.send([]);
        }
    });
});

exports.googleapi = onRequest(async (request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    const db = getDatabase()
    let settingdata = await db.ref('settings').once("value");
    let settings = settingdata.val();
    if(settings.blockIps){
        var ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
        if(ip.includes(",")){
            ip = ip.split(",")[0];
        }
        if(ip.includes(".")){
            ip = ip.replaceAll(".", "-");
        }
        let blockdata = await db.ref('blocklist').once("value");
        let blocklist = blockdata.val();
        if(blocklist && blocklist[ip]){
            response.send({success: false});
            return;
        }
        const day = new Date().getFullYear() + '-' + new Date().getMonth() + '-' + new Date().getDate();
        db.ref('ipList').child(day).child(ip).set(admin.database.ServerValue.increment(1));
    }
    let json = await rgf.apiCallGoogle(request, settings, config);
    response.send(json);
});

exports.success = onRequest(async (request, response) => {
    const db = getDatabase()
    const language = Object.values((await db.ref("languages").orderByChild("default").equalTo(true).once('value')).val())[0].keyValuePairs;
    var amount_line = request.query.amount ? `<h3>${language.payment_of}<strong>${request.query.amount}</strong>${language.was_successful}</h3>` : '';
    var order_line = request.query.order_id ? `<h5>${language.order_no}${request.query.order_id}</h5>` : '';
    var transaction_line = request.query.transaction_id ? `<h6>${language.transaction_id}${request.query.transaction_id}</h6>` : '';
    response.status(200).send(`
        <!DOCTYPE HTML>
        <html>
        <head> 
            <meta name='viewport' content='width=device-width, initial-scale=1.0'> 
            <title>${language.success_payment}</title> 
            <style> 
                body { font-family: Verdana, Geneva, Tahoma, sans-serif; } 
                h3, h6, h4 { margin: 0px; } 
                .container { display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; padding: 60px 0; } 
                .contentDiv { padding: 40px; box-shadow: 0px 0px 12px 0px rgba(0, 0, 0, 0.3); border-radius: 10px; width: 70%; margin: 0px auto; text-align: center; } 
                .contentDiv img { width: 140px; display: block; margin: 0px auto; margin-bottom: 10px; } 
                .contentDiv h3 { font-size: 22px; } 
                .contentDiv h6 { font-size: 13px; margin: 5px 0; } 
                .contentDiv h4 { font-size: 16px; } 
            </style>
        </head>
        <body> 
            <div class='container'>
                <div class='contentDiv'> 
                    <img src='https://cdn.pixabay.com/photo/2012/05/07/02/13/accept-47587_960_720.png' alt='Icon'> 
                    ${amount_line}
                    ${order_line}
                    ${transaction_line}
                    <h4>${language.payment_thanks}</h4>
                </div>
            </div>
            <script type="text/JavaScript">setTimeout("location.href = '${request.query.order_id && request.query.order_id.startsWith('wallet')?"/userwallet":"/bookings"}';",5000);</script>
        </body>
        </html>
    `);
});

exports.cancel = onRequest(async(request, response) => {
    const db = getDatabase()
    const language = Object.values((await db.ref("languages").orderByChild("default").equalTo(true).once('value')).val())[0].keyValuePairs;
    response.send(`
        <!DOCTYPE HTML>
        <html>
        <head> 
            <meta name='viewport' content='width=device-width, initial-scale=1.0'> 
            <title>${language.payment_cancelled}</title> 
            <style> 
                body { font-family: Verdana, Geneva, Tahoma, sans-serif; } 
                .container { display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; padding: 60px 0; } 
                .contentDiv { padding: 40px; box-shadow: 0px 0px 12px 0px rgba(0, 0, 0, 0.3); border-radius: 10px; width: 70%; margin: 0px auto; text-align: center; } 
                .contentDiv img { width: 140px; display: block; margin: 0px auto; margin-bottom: 10px; } 
                h3, h6, h4 { margin: 0px; } .contentDiv h3 { font-size: 22px; } 
                .contentDiv h6 { font-size: 13px; margin: 5px 0; } 
                .contentDiv h4 { font-size: 16px; } 
            </style>
        </head>
        <body> 
            <div class='container'> 
                <div class='contentDiv'> 
                    <img src='https://cdn.pixabay.com/photo/2012/05/07/02/13/cancel-47588_960_720.png' alt='Icon'> 
                    <h3>${language.payment_fail}</h3> 
                    <h4>${language.try_again}</h4>
                </div> 
            </div>
            <script type="text/JavaScript">setTimeout("location.href = '/bookings';",5000);</script>
        </body>
        </html>
    `);
});

exports.updateBooking = onValueUpdated(
    {
        ref: '/bookings/{bookingId}',
    }, async (event) =>{
        const db = getDatabase();
        let oldrow = event.data.before.val();
        let booking = event.data.after.val();
        const langSnap = await db.ref("languages").orderByChild("default").equalTo(true).once('value');
        const language = Object.values(langSnap.val())[0].keyValuePairs;
        booking.key = event.params.bookingId;

        if (!booking.bookLater && oldrow.status === 'PAYMENT_PENDING' && booking.status === 'NEW' && !booking.requestedDrivers && booking.preRequestedDrivers) {
            db.ref('bookings').child(booking.key).update({
               requestedDrivers : booking.preRequestedDrivers,
               preRequestedDrivers: {}
            })
            Object.keys(booking.preRequestedDrivers).map(async (key)=>{
                const snapshot = await db.ref("users/" + key).once('value');
                let driver = snapshot.val();
                if(driver.pushToken){
                    RequestPushMsg(
                        driver.pushToken, 
                        {
                            title: language.notification_title, 
                            msg: language.new_booking_notification,
                            screen: 'DriverTrips'
                        }
                    );
                }
            });
       }

        if (oldrow.status !== booking.status && booking.status === 'CANCELLED') {
            if (booking.customer_paid && parseFloat(booking.customer_paid) > 0 && booking.payment_mode!=='cash') {
                addToWallet(booking.customer, parseFloat(booking.customer_paid), "Admin Credit", null);
            }
            if (booking.booking_from_web && booking.payment_mode!=='cash' && appcat && appcat === "bidcab") {
                addToWallet(booking.customer, parseFloat(booking.payableAmount), "Admin Credit", null)
            }
            if (oldrow.status === 'ACCEPTED' && booking.cancelledBy === 'customer') {
                db.ref("tracking/" + booking.key).orderByChild("status").equalTo("ACCEPTED").once("value", (sdata) => {
                    let items = sdata.val();
                    if (items) {
                        let accTime;
                        for (let skey in items) {
                            accTime = new Date(items[skey].at);
                            break;
                        }
                        let date1 = new Date();
                        let date2 = new Date(accTime);
                        let diffTime = date1 - date2;
                        let diffMins = diffTime / (1000 * 60);
                        db.ref("cartypes").once("value", async (cardata) => {
                            const cars = cardata.val();
                            let cancelSlab = null;
                            for (let ckey in cars) {
                                if (booking.carType === cars[ckey].name) {
                                    cancelSlab = cars[ckey].cancelSlab;
                                }
                            }
                            let deductValue = 0;
                            if (cancelSlab) {
                                for (let i = 0; i < cancelSlab.length; i++) {
                                    if (diffMins > parseFloat(cancelSlab[i].minsDelayed)) {
                                        deductValue = cancelSlab[i].amount;
                                    }
                                }
                            }
                            if (deductValue > 0) {
                                await db.ref("bookings/" + booking.key + "/cancellationFee").set(deductValue);
                                deductFromWallet(booking.customer, deductValue, 'Cancellation Fee');
                                addToWallet(booking.driver, deductValue, "Cancellation Fee", null);
                            }
                        })
                        
                    }
                })
            }
        }
        if (booking.status === 'COMPLETE' && booking.tipamount &&booking.tipamount>0) {
            addToWallet(booking.driver, booking.tipamount, "Tip", booking.id);
            deductFromWallet(booking.customer, booking.tipamount, "Tip");
        } 
        if (booking.status === 'COMPLETE') {
            const language = Object.values((await db.ref("languages").orderByChild("default").equalTo(true).once('value')).val())[0].keyValuePairs;
            let detailsData = await db.ref("smtpdata").once("value");
            let details = detailsData.val();
            let settingdata = await db.ref('settings').once("value");
            let settings = settingdata.val();
            if(details){
                try{
                    var transporter = nodemailer.createTransport(details.smtpDetails);
                    var createdAtDate = new Date(booking.tripdate);
                    var triphours = new Date(booking.tripdate).getHours();
                    var tripmin = new Date(booking.tripdate).getMinutes();
                    var formattedTripDate = createdAtDate.toLocaleDateString();

                    var createdAtBookingDate = new Date(booking.bookingDate);
                    var bookinghours = new Date(booking.bookingDate).getHours();
                    var bookingmin = new Date(booking.bookingDate).getMinutes();
                    var formattedBookingDate = createdAtBookingDate.toLocaleDateString();
                    let html = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Document</title>
                <style>
                    body{
                        background-color: #009CA36,
                        margin: 0,
                        padding: 0
                    }
                    h1,h2,h3,h4,h5,h6{
                        margin: 0;
                        padding: 0;
                    }
                    .heading{
                        font-size: 20px;
                        margin-bottom: 08px;
                    }
                    table{
                        background-color: #fff;
                        width: 100%;
                        border-collapse: collapse;
                    }
                    table thead tr{
                        border: 1px solid #111;
                        background-color: #f2f2f2;
                    }
                    table td {
                        vertical-align: middle !important;
                        text-align: center;
                    }
                    table th, table td {
                        padding-top: 08px;
                        padding-bottom: 08px;
                    }
                    .table-bordered{
                        box-shadow: 0px 0px 5px 0.5px gray;
                    }
                    .table-bordered td, .table-bordered th {
                        border: 0px solid #dee2e6;
                    }
                    .text-left{
                        text-align: start;
                    }
                </style>
            
                        </head>
                        <body style="font-family: Arial">
                        <div style="margin-top: 10px; padding-top: 10px">
                            <div
                                style="
                                border-bottom: 2px solid #009CA3;
                                display: flex;
                                justify-content: space-between;
                                "
                                >
                                <div>
                                    <h1 style="color: black; margin: 0px">${settings.appName} </h1>
                                    <p style="color: grey">${language.riding_thanks} , ${booking.customer_name}</p>
                                    <p style="color: blue">${language.email_msg}</p>
                                </div>
                                <div
                                    style="
                                    display: flex;
                                    flex-direction: column;
                                    justify-content: space-between;
                                    "
                                    >
                                    <div id="dateField"; style="color: blue">${language.date} : ${formattedTripDate}</div>
                                    <img
                                    style="width:80px;height:60px;"
                                    src="https://cdn.pixabay.com/photo/2022/01/23/18/20/car-6961567_640.png"
                                    />
                                </div>
                            </div>
                            <div>
                                <div>
                                    <table >
                                        <tbody>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.booking_id}</td>
                                                <td id="subtotal">${booking.reference} </td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.booking_date_time}</td>
                                                <td id="subtotal"> ${formattedBookingDate} ${bookinghours}:${bookingmin} </td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.pickup_location}</td>
                                                <td id="subtotal">${booking.pickupAddress} </td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.drop_location}</td>
                                                <td id="subtotal">${booking.dropAddress} </td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.trip_date_time}</td>
                                                <td id="subtotal">${formattedTripDate} ${triphours}:${tripmin}</td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.driver_name}</td>
                                                <td id="subtotal">${booking.driver_name}</td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.car_type}</td>
                                                <td id="subtotal">${booking.carType}</td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.payment_mode}</td>
                                                <td id="subtotal">${booking.payment_mode}</td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.distance}</td>
                                                <td id="subtotal">${booking.distance}${settings.convert_to_mile ? language.mile : language.km }</td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.Discounts}</td>
                                                <td>${booking.discount ? booking.discount : 0}</td>
                                            </tr>
                                             <tr>
                                                <td colspan="3" class="text-left">${language.Customer_paid}</td>
                                                <td>${booking.customer_paid ? booking.customer_paid : 0}</td>
                                            </tr>
                                            <tr>
                                                <td colspan="3" class="text-left">${language.total}</td>
                                                <td>${booking.trip_cost}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        </body>
                        </html>`;
                    transporter.sendMail({
                        from: details.fromEmail,
                        to: booking.customer_email,
                        subject: language.ride_details_page_title,
                        html: html,
                    }).then(res => console.log('successfully sent that mail')).catch(err => console.log(err));
                }catch(error){
                    console.log(error.toString());
                }
            }
        }
        if(booking.payment_mode ==='wallet' && 
            (
                (oldrow.status === 'PAYMENT_PENDING' && booking.status === 'NEW' && booking.prepaid) ||
                (oldrow.status === 'PENDING' && booking.status === 'PAID' && !booking.prepaid) ||
                (oldrow.status === 'REACHED' && booking.status === 'COMPLETE' && !booking.prepaid) ||
                (oldrow.status === 'NEW' && booking.status === 'ACCEPTED' && booking.prepaid &&  !(booking.customer_paid &&  parseFloat(booking.customer_paid)>=0)) ||
                (oldrow.status === 'NEW' && booking.status === 'ACCEPTED' && oldrow.selectedBid && !booking.selectedBid && booking.prepaid)
            )
        ) {
            const snapshot = await db.ref("users/" + booking.customer).once('value');
            let profile = snapshot.val();
            const settingdata = await db.ref('settings').once("value");
            let settings = settingdata.val();
            let walletBal = parseFloat(profile.walletBalance) - parseFloat(parseFloat(booking.trip_cost) - parseFloat(booking.discount));
            let tDate = new Date();
            let details = {
                type: 'Debit',
                amount: parseFloat(parseFloat(booking.trip_cost) - parseFloat(booking.discount)),
                date: tDate.getTime(),
                txRef: booking.id
            }
            await db.ref("users/" + booking.customer).update({walletBalance: parseFloat(parseFloat(walletBal).toFixed(settings.decimal))})
            await db.ref("walletHistory/" + booking.customer).push(details);
            const langSnap = await db.ref("languages").orderByChild("default").equalTo(true).once('value');
            const language = Object.values(langSnap.val())[0].keyValuePairs;
            if(profile.pushToken){
                RequestPushMsg(
                    profile.pushToken,
                    {
                        title: language.notification_title,
                        msg: language.wallet_updated,
                        screen: 'Wallet',
                        ios:  profile.userPlatform === "IOS"? true: false
                    }
                );
            }
        }
        if((oldrow.status === 'REACHED' && booking.status === 'PAID') || 
           (oldrow.status === 'PENDING' && booking.status === 'PAID') ||
           (oldrow.status === 'PENDING' && booking.status === 'COMPLETE') ||
           (oldrow.status === 'REACHED' && booking.status === 'COMPLETE')
        ){
            const snapshotDriver = await db.ref("users/" + booking.driver).once('value');
            let profileDriver = snapshotDriver.val();
            const settingdata = await db.ref('settings').once("value");
            let settings = settingdata.val();
            let driverWalletBal = parseFloat(profileDriver.walletBalance);
            if(booking.payment_mode ==='cash' && booking.cashPaymentAmount && parseFloat(booking.cashPaymentAmount)> 0){
                let details = {
                    type: 'Debit',
                    amount: booking.cashPaymentAmount,
                    date: new Date().getTime(),
                    txRef: booking.id
                }
                await db.ref("walletHistory/" + booking.driver).push(details);
                driverWalletBal = driverWalletBal - parseFloat(booking.cashPaymentAmount);
            }
            if(booking.fleetadmin && booking.fleetadmin.length>0 && booking.fleetCommission &&  booking.fleetCommission>0){
                const snapshotFleet = await db.ref("users/" + booking.fleetadmin).once('value');
                let profileFleet = snapshotFleet.val();
                let fleetWalletBal = parseFloat(profileFleet.walletBalance);
                fleetWalletBal = fleetWalletBal + parseFloat( booking.fleetCommission);
                let detailsFleet = {
                    type: 'Credit',
                    amount: booking.fleetCommission,
                    date: new Date().getTime(),
                    txRef: booking.id
                }
                await db.ref("walletHistory/" + booking.fleetadmin).push(detailsFleet);
                await db.ref("users/" + booking.fleetadmin).update({walletBalance: parseFloat(parseFloat(fleetWalletBal).toFixed(settings.decimal))})
            }
            driverWalletBal = driverWalletBal + parseFloat(booking.driver_share);
            let driverDetails = {
                type: 'Credit',
                amount: booking.driver_share,
                date: new Date().getTime(),
                txRef: booking.id
            }
            await db.ref("users/" + booking.driver).update({walletBalance: parseFloat(parseFloat(driverWalletBal).toFixed(settings.decimal))})
            await db.ref("walletHistory/" + booking.driver).push(driverDetails);
            const langSnap = await db.ref("languages").orderByChild("default").equalTo(true).once('value');
            const language = Object.values(langSnap.val())[0].keyValuePairs;
            if(profileDriver.pushToken){
                RequestPushMsg(
                    profileDriver.pushToken,
                    {
                        title: language.notification_title,
                        msg: language.wallet_updated,
                        screen: 'Wallet',
                        ios:  profileDriver.userPlatform === "IOS"? true: false
                    }
                );
            }
        }
    }
)

exports.withdrawCreate = onValueCreated(
    {
      ref: '/withdraws/{wid}',
    },
    async (event) => {
      let wid = event.params.wid;
      let withdrawInfo = event.data.val();
      let uid = withdrawInfo.uid;
      let amount = withdrawInfo.amount;
  
      const db = getDatabase();
      const userData = await db.ref("users/" + uid).once('value');
      let profile = userData.val();
      const settingdata = await db.ref('settings').once("value");
      let settings = settingdata.val();
      let walletBal = parseFloat(profile.walletBalance) - parseFloat(amount);
  
      let tDate = new Date();
      let details = {
        type: 'Withdraw',
        amount: amount,
        date: tDate.getTime(),
        txRef: tDate.getTime().toString(),
        transaction_id: wid
      };
      
      await db.ref("users/" + uid).update({ walletBalance: parseFloat(parseFloat(walletBal).toFixed(settings.decimal)) });
      await db.ref("walletHistory/" + uid).push(details);
  
      const langSnap = await db.ref("languages").orderByChild("default").equalTo(true).once('value');
      const language = Object.values(langSnap.val())[0].keyValuePairs;
      
      if (profile.pushToken) {
        RequestPushMsg(
          profile.pushToken,
          {
            title: language.notification_title,
            msg: language.wallet_updated,
            screen: 'Wallet',
            ios: profile.userPlatform === 'IOS' ? true : false
          }
        );
      }
    }
  );

  exports.bookingScheduler = onSchedule('every 1 minutes', async (event) => {
    const db = getDatabase();
    const settingdata = await db.ref('settings').once("value");
    let settings = settingdata.val();

    if(settings.blockIps){
        const day = new Date().getFullYear() + '-' + new Date().getMonth() + '-' + new Date().getDate();
        const ipData =  await db.ref('ipList').child(day).once("value");
        const iplist = ipData.val();
        const limit = settings.blockIpCount? settings.blockIpCount: 100;
        for(let ip of Object.keys(iplist)){
            if(iplist[ip] >= limit){
                db.ref('blocklist').child(ip).set(true);
            }
        }
    }

    db.ref('/bookings').orderByChild("status").equalTo('NEW').once("value", (snapshot) => {
        let bookings = snapshot.val();
        if (bookings) {
            for (let key in bookings) {
                let booking = bookings[key];
                booking.key = key;
                let date1 = new Date();
                let date2 = new Date(booking.tripdate);
                let diffTime = date2 - date1;
                let diffMins = diffTime / (1000 * 60);
                if ((diffMins > 0 && diffMins < 15 && booking.bookLater && !booking.requestedDrivers) || diffMins < -1) {
                    db.ref('/users').orderByChild("queue").equalTo(false).once("value", async (ddata) => {
                        let drivers = ddata.val();
                        if (drivers) {
                            const langSnap = await db.ref("languages").orderByChild("default").equalTo(true).once('value');
                            const language = Object.values(langSnap.val())[0].keyValuePairs;
                            for (let dkey in drivers) {
                                let driver = drivers[dkey];
                                driver.key = dkey;
                                if(!(booking.requestedDrivers && booking.requestedDrivers[dkey])){
                                    db.ref("locations/" + dkey).once("value", driverlocdata => {
                                        let location = driverlocdata.val();
                                        if (driver.usertype === 'driver' && driver.approved === true && driver.driverActiveStatus === true && location && ((driver.carApproved ===true && settings.carType_required) || !settings.carType_required) && ((driver.term === true && settings.term_required) || !settings.term_required) && ((driver.licenseImage && settings.license_image_required) || !settings.license_image_required )) {
                                            let originalDistance = getDistance(booking.pickup.lat, booking.pickup.lng, location.lat, location.lng);
                                            if(settings.convert_to_mile){
                                                originalDistance = originalDistance / 1.609344;
                                            }
                                            if (originalDistance <= settings.driverRadius && ((driver.carType === booking.carType  && settings.carType_required) || !settings.carType_required) && settings.autoDispatch) {
                                                db.ref('bookings/' + booking.key + '/requestedDrivers/' + driver.key).set(true);
                                                addEstimate(booking.key, driver.key, originalDistance, booking.deliveryWithBid);
                                                if(driver.pushToken){
                                                    RequestPushMsg(
                                                        driver.pushToken, 
                                                        {
                                                            title: language.notification_title, 
                                                            msg: language.new_booking_notification,
                                                            screen: 'DriverTrips'
                                                        }
                                                    );
                                                }
                                                return true;
                                            }
                                            return true;
                                        }else{
                                            return false;
                                        }
                                    });
                                }
                            }
                        } else {
                            return false;
                        }
                        return true;
                    });
                }
                if (diffMins < -30) {
                    db.ref("bookings/" + booking.key + "/requestedDrivers").remove();
                    db.ref('bookings/' + booking.key).update({
                        status: 'CANCELLED',
                        reason: 'RIDE AUTO CANCELLED. NO RESPONSE',
                        cancelledBy: 'admin'
                    });
                    return true;
                }
            }
        }
        else {
            return false;
        }
        return true;
    });
});


exports.userDelete = onValueDeleted(
    {
        ref: "/users/{uid}",
    },
    async (event) => {
        try {
            const uid = event.params.uid;
            await admin.auth().deleteUser(uid); 
            console.log(`User with UID: ${uid} has been deleted.`);
        } catch (error) {
            console.error(`Error deleting user with UID: ${event.params.uid}`, error);
        }
    });

  exports.userCreate = onValueCreated(
    {
      ref: "/users/{uid}",
    },
    async (event) => {
      try {
        const uid = event.params.uid;
        const userInfo = event.data.val();
        const userCred = { uid: uid };
  
        if (userInfo.mobile) {
          userCred.phoneNumber = userInfo.mobile;
        }
        if (userInfo.email) {
          userCred.email = userInfo.email;
        }
        try {
          await getAuth().getUser(uid);
          console.log("User already exists with UID:", uid);
        } catch (error) {
          if (uid === "admin0001") {
            userCred.password = "Admin@123";
          }
          await getAuth().createUser(userCred);
          console.log("User successfully created with UID:", uid);
        }
      } catch (error) {
        console.error("Error handling user creation:", error);
      }
    }
  );

  exports.send_notification = functions.https.onRequest(async (req, res) => {
    try {
      const settingDataSnapshot = await admin.database().ref("settings").once("value");
      const settings = settingDataSnapshot.val();
      const allowedOrigins = ['https://' + config.firebaseProjectId + '.web.app', settings.CompanyWebsite];
  
      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
      }
      res.set("Access-Control-Allow-Headers", "Content-Type");
  
      const notification = req.body.notification;
  
      if (notification) {
        const snapshot = await admin
          .database()
          .ref("users")
          .orderByChild("usertype")
          .equalTo(notification.usertype)
          .once("value");
        const usersSnap = snapshot.val();
  
        if (usersSnap) {
          const users = Object.values(usersSnap);
          const tokens = users
            .filter(
              (usr) =>
                usr.pushToken &&
                usr.pushToken !== "web" &&
                usr.pushToken !== "token_error" &&
                usr.pushToken !== "init" &&
                usr.pushToken !== null &&
                usr.usertype === notification.usertype &&
                (usr.userPlatform === notification.devicetype || notification.devicetype === "All")
            )
            .map((usr) => usr.pushToken);
  
          if (tokens.length > 0) {
            const chunkSize = 100;
            if (tokens.length > 500) {
              for (let i = 0; i < tokens.length; i += chunkSize) {
                const chunk = tokens.slice(i, i + chunkSize);
                const data = {
                  title: notification.title,
                  msg: notification.body,
                };
                // eslint-disable-next-line no-await-in-loop
                await admin.database().ref("packets").push({
                  chunk,
                  data,
                });
              }
              res.send({ success: true, message: "Notifications queued in packets." });
            } else {
              let processed = 0;
              for (let i = 0; i < tokens.length; i += chunkSize) {
                const chunk = tokens.slice(i, i + chunkSize);
                const data = {
                  title: notification.title,
                  msg: notification.body,
                };
  
                try {
                  // eslint-disable-next-line no-await-in-loop
                  await RequestPushMsg(chunk, data);
                  processed += chunk.length;
                  if (processed === tokens.length) {
                    res.send({ success: true });
                  }
                } catch (error) {
                  console.error(error);
                  processed += chunk.length;
                  if (processed === tokens.length) {
                    res.send({ success: false, error: "Some notifications failed." });
                  }
                }
              }
            }
          }
        }
      } else {
        const data = {
          title: req.body.title,
          msg: req.body.msg,
        };
  
        if (req.body.screen) {
          data.screen = req.body.screen;
        }
  
        if (req.body.params) {
          data.params = req.body.params;
        }
  
        if (req.body.ios) {
          data.ios = req.body.ios;
        }
  
        try {
          const responseData = await RequestPushMsg(req.body.token, data);
          res.send(responseData);
        } catch (error) {
          res.send({ error });
        }
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: "Internal server error." });
    }
  });


  exports.check_user_exists = onRequest( async(request, response) => {
    const db = getDatabase();
    let settingdata = await db.ref('settings').once("value");
    let settings = settingdata.val();
    const allowedOrigins = ['https://' + config.firebaseProjectId + '.web.app', settings.CompanyWebsite, 'http://localhost:3000'];
    const origin = request.headers.origin;
    if (allowedOrigins.includes(origin)) {
        response.set("Access-Control-Allow-Origin", origin);
        response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (request.method === 'OPTIONS') {
        response.set("Access-Control-Allow-Methods", "POST");
        response.set("Access-Control-Max-Age", "3600");
        response.status(204).send('');
        return;
    }
    let arr = [];
    const user = await rgf.validateBasicAuth(request.headers.authorization, config);
    if(user){
        if (request.body.email || request.body.mobile) {
            if (request.body.email) {
                arr.push({ email: request.body.email });
            }
            if (request.body.mobile) {
                arr.push({ phoneNumber: request.body.mobile });
            }
            try{
                admin
                .auth()
                .getUsers(arr)
                .then((getUsersResult) => {
                    response.send({ users: getUsersResult.users });
                    return true;
                })
                .catch((error) => {
                    response.send({ error: error });
                });
            }catch(error){
                response.send({ error: error });
            }
        } else {
            response.send({ error: "Email or Mobile not found." });
        }
    }else{
        response.send({ error: 'Unauthorized api call' });
    }
});


exports.validate_referrer = onRequest(async (request, response) => {
    const db = getDatabase();
    let referralId = request.body.referralId;
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    const snapshot = await db.ref("users").once('value');
    let value = snapshot.val();
    if(value){
        let arr = Object.keys(value);
        let key;
        for(let i=0; i < arr.length; i++){
            if(value[arr[i]].referralId === referralId){
                key = arr[i];
            }
        }
        response.send({uid: key}); 
    }else{
        response.send({uid: null});
    }
});

exports.user_signup = onRequest(async (request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");

    const userDetails = request.body.regData;
    const db = getDatabase();
    const auth = getAuth();

    let settingData = await db.ref('settings').once("value");
    let settings = settingData.val();

    try {
        const regData = await rgf.valSignupData(config, userDetails, settings);

        if (regData.error) {
            response.send(regData);
        } else {
            const userRecord = await auth.createUser({
                email: userDetails.email,
                phoneNumber: userDetails.mobile,
                password: userDetails.password,
                emailVerified: true
            });

            if (userRecord && userRecord.uid) {
                await db.ref('users/' + userRecord.uid).set(regData);
                if (userDetails.signupViaReferral && settings.bonus > 0) {
                    await addToWallet(userDetails.signupViaReferral, settings.bonus, "Admin Credit", null);
                    await addToWallet(userRecord.uid, settings.bonus, "Admin Credit", null);
                }
                response.send({ uid: userRecord.uid });
            } else {
                response.send({ error: "User Not Created" });
            }
        }
    } catch (error) {
        response.send({ error: "User Not Created" });
    }
});

exports.update_user_email = onRequest(async (request, response) => {
    const db = getDatabase();
    let settingdata = await db.ref('settings').once("value");
    let settings = settingdata.val();
    const allowedOrigins = ['https://' + config.firebaseProjectId + '.web.app', settings.CompanyWebsite];
    const origin = request.headers.origin;
    if (allowedOrigins.includes(origin)) {
        response.set("Access-Control-Allow-Origin", origin);
    }
    response.set("Access-Control-Allow-Headers", "Content-Type");
    const user = await rgf.validateBasicAuth(request.headers.authorization, config);
    if(user){
        const uid = request.body.uid;
        const email = request.body.email;
        if(email){
            admin.auth().updateUser(uid, {
                email: email,
                emailVerified: true
            })
            .then((userRecord) => {
                let updateData = {uid: uid, email: email };
                if(request.body.firstName){
                    updateData['firstName'] = request.body.firstName;
                }
                if(request.body.lastName){
                    updateData['lastName'] = request.body.lastName;
                }
                db.ref("users/" + uid).update(updateData);
                response.send({ success: true, user: userRecord });
                return true;
            })
            .catch((error) => {
                response.send({ error: "Error updating user" });
            });
        }else{ 
            response.send({ error: "Request email not found" });
        }
    }else{
        response.send({ error: 'Unauthorized api call' });
    }
});

exports.gettranslation = onRequest((request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    translate(request.query.str, { from: request.query.from, to: request.query.to  })
        .then(res => {
            response.send({text:res.text})
            return true;
        }).catch(err => {
            response.send({error:err.toString()})
            return false;
        });
});  

exports.getservertime = onRequest((request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.send({time: new Date().getTime()})
}); 

exports.checksmtpdetails = onRequest(async(request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");

    try {
        const smtpDetails = request.body.smtpDetails;
        const fromEmail = request.body.fromEmail;

        var transporter = nodemailer.createTransport(request.body.smtpDetails);

        const mailOptions = {
            from: fromEmail,
            to: fromEmail, 
            subject: "Test Mail", 
            text: "Hi, this is a test email.", 
            html: `
            <!DOCTYPE html>
            <html>
            <head><style>table, th, td { border: 1px solid black;}</style></head>
            <body>
            <div class="w3-container">
                <h4>Hi, this is a test email.</h4>
            </div>
            </body>
            </html>`, 
        };

        transporter.sendMail(mailOptions)
            .then((res) => {
                admin.database().ref("smtpdata").set({
                    fromEmail:fromEmail,
                    smtpDetails: smtpDetails
                })
                response.send({ success: true})
                return true;
            })
            .catch((error) => {
                response.send({ error: error.toString()})
            });
    } catch(error){
        response.send({ error: error.toString() })
    }
}); 

exports.check_auth_exists = onRequest(async (request, response) => {
    const db = getDatabase()
    let settingdata = await db.ref('settings').once("value");
    let settings = settingdata.val();
    const allowedOrigins = ['https://' + config.firebaseProjectId + '.web.app', settings.CompanyWebsite];
    const origin = request.headers.origin;
    if (allowedOrigins.includes(origin)) {
        response.set("Access-Control-Allow-Origin", origin);
    }
    response.set("Access-Control-Allow-Headers", "Content-Type");
    let data = JSON.parse(request.body.data);
    const userData = await rgf.formatUserProfile(request, config, data);
    if(userData.uid){
        db.ref('users/' + userData.uid).set(userData);
    }
    response.send(userData)
});


exports.request_mobile_otp = onRequest(async (request, response) => {
    const db = getDatabase();
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    const mobile = request.body.mobile;
    const timestamp = new Date().getTime();
    const otp = Math.floor(100000 + Math.random() * 900000);
    const langSnap = await db.ref("languages").orderByChild("default").equalTo(true).once('value');
    const language = Object.values(langSnap.val())[0].keyValuePairs;
    if(language){
        try{ 
            const mobileList = await db.ref("/otp_auth_requests").orderByChild("mobile").equalTo(mobile).once('value');
            const listData = mobileList.val();
            const info = Object.keys(listData? listData: {});
            if(info){
                for(let i=0;i<info.length; i++){
                    if(listData[info[i]].mobile === mobile){
                        db.ref(`/otp_auth_requests/${info[i]}`).remove();
                    }
                }
            }
        } catch(error){
            //Ignore if no previous record.
        }

        let smsConfigData = await db.ref('smsConfig').once("value");
        let smsConfig = smsConfigData.val();

        const data = {
            mobile: mobile,
            dated: timestamp,
            otp: otp
        };
        let resMsg = await rgf.callMsgApi(config, smsConfig, data);
        await db.ref(`/otp_auth_requests`).push(data);
        response.send({"success" : true})

    }else{
        response.send({ error: "Setup error" });
    } 
});

exports.verify_mobile_otp = onRequest(async (request, response) => {
    const db = getDatabase()
    let settingdata = await db.ref('settings').once("value");
    let settings = settingdata.val();
    const allowedOrigins = ['https://' + config.firebaseProjectId + '.web.app', settings.CompanyWebsite];
    const origin = request.headers.origin;
    if (allowedOrigins.includes(origin)) {
        response.set("Access-Control-Allow-Origin", origin);
    }
    response.set("Access-Control-Allow-Headers", "Content-Type");
    const mobile = request.body.mobile;
    const otp = request.body.otp;
    const mobileList = await db.ref("/otp_auth_requests").orderByChild("mobile").equalTo(mobile).once('value');
    const listData = mobileList.val();
    if(listData){
        let check = await rgf.otpCheck(config, mobile, listData);
        if(check.errorStr){
            await db.ref(`/otp_auth_requests/${check.key}`).remove();
            response.send({ error:check.errorStr });
        } else{
            if(check.data.mobile){
                if(parseInt(check.data.otp) === parseInt(otp)){
                    let userRecord;
                    try{
                        userRecord = await admin.auth().getUserByPhoneNumber(mobile);
                    } catch (error){
                        userRecord = await admin.auth().createUser({
                            phoneNumber: mobile
                        });
                    }
                    try{
                        const customToken =  await admin.auth().createCustomToken(userRecord.uid);
                        response.send({ token: customToken });  
                    } catch (error){
                        console.log(error);
                        response.send({ error: "Error creating custom token" });
                    }
                } else {
                    check.data['count'] = check.data.count? check.data.count + 1: 1;
                    await db.ref(`/otp_auth_requests/${check.key}`).update(check.data);
                    response.send({ error: "OTP mismatch" });
                }
            }else{
                response.send({ error: "Request mobile not found" });
            }
        }
    }else{ 
        response.send({ error: "Request mobile not found" });
    }
});

exports.update_auth_mobile = onRequest(async (request, response) => {
    const db = getDatabase();
    let settingdata = await db.ref('settings').once("value");
    let settings = settingdata.val();
    const allowedOrigins = ['https://' + config.firebaseProjectId + '.web.app', settings.CompanyWebsite];
    const origin = request.headers.origin;
    if (allowedOrigins.includes(origin)) {
        response.set("Access-Control-Allow-Origin", origin);
    }
    response.set("Access-Control-Allow-Headers", "Content-Type");
    const uid = request.body.uid;
    const mobile = request.body.mobile;
    const otp = request.body.otp;
    const mobileList = await db.ref("/otp_auth_requests").orderByChild("mobile").equalTo(mobile).once('value');
    const listData = mobileList.val();
    if(listData){
        let check = await rgf.otpCheck(config, mobile, listData);
        if(check.errorStr){
            await db.ref(`/otp_auth_requests/${check.key}`).remove();
            response.send({ error: check.errorStr });
        } else{
            if(check.data.mobile){
                if(parseInt(check.data.otp) === parseInt(otp)){
                    admin.auth().updateUser(uid, {
                        phoneNumber: mobile
                    })
                    .then((userRecord) => {
                        response.send({ success: true, user: userRecord });
                        return true;
                    })
                    .catch((error) => {
                        response.send({ error: "Error updating user" });
                    });
                } else {
                    check.data['count'] = check.data.count? check.data.count + 1: 1;
                    await db.ref(`/otp_auth_requests/${check.key}`).update(check.data);
                    response.send({ error: "OTP mismatch" });
                }
            }else{
                response.send({ error: "Request mobile not found" });
            }
        }
    }else{ 
        response.send({ error: "Request mobile not found" });
    }
});