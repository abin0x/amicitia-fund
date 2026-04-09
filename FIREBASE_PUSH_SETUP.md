# Firebase Push Setup

This project now supports:

- Android push notifications when the app is closed or in the background
- Foreground in-app alerts while the app is open
- A notifications inbox screen inside the app

## 1. Create Firebase project

1. Go to Firebase Console
2. Create a project
3. Add an Android app with package name: `com.amicitia.app`
4. Download `google-services.json`
5. Place it at `android/app/google-services.json`

## 2. Enable Cloud Messaging

1. In Firebase Console, open your project
2. Go to `Project settings`
3. Confirm Cloud Messaging is enabled

## 3. Create service account credentials

1. Go to `Project settings` -> `Service accounts`
2. Generate a new private key
3. Keep the JSON file private

You will need:

- `project_id`
- `client_email`
- `private_key`

## 4. Set Supabase Edge Function secrets

Run these commands with your real values:

```sh
supabase secrets set FIREBASE_PROJECT_ID=your-project-id
supabase secrets set FIREBASE_CLIENT_EMAIL=your-service-account-email
supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

If you already use remote Supabase:

```sh
supabase link --project-ref your-project-ref
supabase secrets set FIREBASE_PROJECT_ID=your-project-id
supabase secrets set FIREBASE_CLIENT_EMAIL=your-service-account-email
supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 5. Deploy Supabase migration and function

```sh
supabase db push
supabase functions deploy send-push-notification
```

## 6. Build Android again

After adding `google-services.json`, run:

```sh
npm run cap:sync
```

Then:

```sh
npm run cap:open
```

## 7. Test flow

1. Install the Android app on a real phone
2. Log in as a member once so the device token is registered
3. Log in as admin on another session
4. Approve or reject a payment
5. The member phone should receive the notification
6. Tapping the notification should open the in-app notifications page

## Notes

- Push delivery is Android-focused in the current implementation
- Web push is not included here
- If a device token becomes invalid, the backend marks it inactive
