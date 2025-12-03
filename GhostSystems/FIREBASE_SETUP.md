# Firebase Setup for Local Scripts

To run scripts that need Firebase access locally (like `fix-archived`), you need to provide Firebase credentials.

## Option 1: Create a .env file (Recommended)

Create a `.env` file in the `GhostSystems/` directory:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project",...}
```

**Note:** The JSON string should be on a single line, or you can escape newlines.

## Option 2: Use a file path

If you have a Firebase service account JSON file on your computer:

1. Place the file somewhere secure (e.g., `GhostSystems/firebase-key.json`)
2. Create a `.env` file in `GhostSystems/` with:
   ```env
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-key.json
   ```

## Option 3: Get from Render

You can copy the Firebase credentials from your Render dashboard:

1. Go to your Render service → **Environment** tab
2. Find `FIREBASE_SERVICE_ACCOUNT_JSON`
3. Copy the entire JSON value
4. Add it to your `.env` file:
   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON={paste the JSON here}
   ```

## Running the script

Once your `.env` file is set up:

```bash
cd GhostSystems
npm run fix:archived
```

## Security Note

⚠️ **Never commit your `.env` file to Git!** It should already be in `.gitignore`.

