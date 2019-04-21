const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

exports.sendNotifications = functions.database.ref('/notifications/{notificationId}').onWrite((event) => {
	// If data is already created exit
	if (event.data.previous.val()) {
		return;
	}

	// Exit when the data is deleted
	if (!event.data.exists()) {
		return;
	}

	// Setup notification
	const NOTIFICATION_SNAPSHOT = event.data;
	const payload = {
		notification: {
			title: `title test ${NOTIFICATION_SNAPSHOT.val().user}`,
			body: NOTIFICATION_SNAPSHOT.val().message,
			icon: NOTIFICATION_SNAPSHOT.val().nodeschoolLogo,
			click_action: `https://${functions.config().firebase.authDomain}`
		}
	};

	function clearInvalidTokens(tokensWithKey, results) {
		const invalidTokens = [];

		results.forEach((result, i) => {
			// if no error return
			if (!result.error) return;
			console.error(`Failure sending notifcation to ${tokensWithKey[i].token}`, result.error);

			switch (result.error.code) {
				case 'messaging/invalid-registration-token':
				case 'messaging/registration-token-not-registered':
					invalidTokens.push(admin.database().ref('/tokens').child(tokensWithKey[i].key).remove());
					break;
				default:
					break;
			}
		});

		return Promise.all(invalidTokens);
	}

	// eslint-disable-next-line consistent-return
	return admin.database().ref('/tokens').once('value').then((data) => {
		if (!data.val()) return;
		const snapshot = data.val();
		const tokensWithKey = [];
		const tokens = [];

		for (let key in snapshot) {
			tokens.push(snapshot[key].token);
			tokensWithKey.push({
				token: snapshot[key].token,
				key
			});
    }
    
    // eslint-disable-next-line consistent-return
    return admin.messaging().sendToDevice(tokens, payload)
      .then((response) => clearInvalidTokens(tokensWithKey, response.results))
      .then(() => admin.database().ref('/notifications').child(NOTIFICATION_SNAPSHOT.key).remove())
      .catch(e => console.error(`Error ${e}`));
	});
});
