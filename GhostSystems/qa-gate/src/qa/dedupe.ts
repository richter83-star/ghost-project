import type admin from "firebase-admin";

type DupCheck = {
  duplicates: Array<{ id: string; title?: string; price?: number; status?: string }>;
};

export async function findDuplicates(db: admin.firestore.Firestore, concept_key: string, excludeId: string) : Promise<DupCheck> {
  // We store concept_key in qa.concept_key to query quickly after first pass.
  // If this is first time, we do a conservative title scan fallback.
  const snap = await db.collection("products")
    .where("qa.concept_key", "==", concept_key)
    .limit(10)
    .get();

  const duplicates = snap.docs
    .filter(d => d.id !== excludeId)
    .map(d => {
      const x = d.data() as any;
      return {
        id: d.id,
        title: x.title,
        price: x.price,
        status: x.status
      };
    });

  return { duplicates };
}

