import os
import random
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

def initialize_firebase():
    """
    Initializes the Firebase Admin SDK.
    """
    secret_file_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_PATH', 'oracle_service_account.json')

    if not os.path.exists(secret_file_path):
        print(f"Error: Service account key file not found at {secret_file_path}")
        print("Please add this file as a 'Secret File' in your Render service settings.")
        return None

    try:
        # Check if app is already initialized to avoid errors
        if not firebase_admin._apps:
            cred = credentials.Certificate(secret_file_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized successfully.")
        else:
            print("Firebase Admin already initialized.")
        return firestore.client()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return None

def generate_product_job(db, jobs_collection_name):
    """
    Generates a sample DIGITAL-ONLY product and writes it to Firestore
    with 'status: pending'.
    """
    if db is None:
        print("Firestore client is not initialized. Exiting.")
        return

    # Strictly Digital Sample Products
    sample_products = [
        {
            "title": "Ultimate Notion CRM System",
            "description": "A complete, pre-built Notion workspace for managing client relationships. Includes dashboard, pipeline view, and contact database. This is a digital download. No physical item will be shipped.",
            "productType": "notion_system",
            "price": 29.00,
            "deliveryType": "digital",
            "imageUrl": "https://placehold.co/600x400/2c2c2c/FFF?text=Notion+CRM+System",
            "digitalContent": "https://notion.so/template-link-placeholder-crm-v1"
        },
        {
            "title": "Midjourney V6 'Cyber-Noir' Prompt Pack",
            "description": "A curated collection of 50 high-quality prompts for generating cyberpunk noir art. Instant digital access. No physical shipping.",
            "productType": "digital_prompt_pack",
            "price": 12.50,
            "deliveryType": "digital",
            "imageUrl": "https://placehold.co/600x400/0f172a/0ea5e9?text=Cyber+Noir+Prompts",
            "digitalContent": "1. /imagine prompt: neon rain slicked street... \n2. /imagine prompt: holographic detective..."
        },
        {
            "title": "E-commerce Email Automation Kit",
            "description": "A set of 10 proven email marketing templates for welcome series, abandoned cart, and post-purchase flows. Digital text files only.",
            "productType": "automation_template",
            "price": 19.99,
            "deliveryType": "digital",
            "imageUrl": "https://placehold.co/600x400/1e293b/FFF?text=Email+Automation+Kit",
            "digitalContent": "Subject: Welcome to the family! \nBody: Hi {{first_name}}, thanks for joining..."
        },
        {
            "title": "YouTube Script Bundle: Tech Reviews",
            "description": "5 plug-and-play script templates for tech review videos. Includes hooks, body structure, and CTA examples. Instant PDF download.",
            "productType": "script_bundle",
            "price": 9.99,
            "deliveryType": "digital",
            "imageUrl": "https://placehold.co/600x400/dc2626/FFF?text=YT+Script+Bundle",
            "digitalContent": "Video 1 Structure: \n0:00 Hook: 'Is this the iPhone killer?'\n0:45 Intro..."
        },
        {
            "title": "Freelance Client Onboarding Workflow",
            "description": "A comprehensive checklist and email sequence for onboarding new freelance clients professionally. Digital asset pack.",
            "productType": "workflow_kit",
            "price": 15.00,
            "deliveryType": "digital",
            "imageUrl": "https://placehold.co/600x400/059669/FFF?text=Client+Onboarding+Kit",
            "digitalContent": "Step 1: Send Contract (Template attached)\nStep 2: Send Welcome Packet..."
        }
    ]

    # Pick a random product to create a job for
    product_data = random.choice(sample_products)
    
    # Add the job-specific fields
    product_data['status'] = 'pending'
    product_data['createdAt'] = datetime.now(timezone.utc)

    try:
        # Add a new document with an auto-generated ID
        doc_ref = db.collection(jobs_collection_name).add(product_data)
        print(f"Successfully created DIGITAL product job with ID: {doc_ref[1].id}")
        print(f"Product: {product_data['title']}")
    except Exception as e:
        print(f"Error creating Firestore job: {e}")

def main():
    """
    Main function to run the Oracle job.
    """
    print(f"Oracle Digital 'brain.py' started at {datetime.now(timezone.utc).isoformat()}")
    
    jobs_collection_name = os.environ.get('FIRESTORE_JOBS_COLLECTION', 'products')
    
    db = initialize_firebase()
    if db:
        generate_product_job(db, jobs_collection_name)
    
    print(f"Oracle Digital 'brain.py' finished at {datetime.now(timezone.utc).isoformat()}")

if __name__ == "__main__":
    main()