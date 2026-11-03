// Les colonnes de la liste. Une seule source : le serveur valide avec, la page s'affiche avec (/api/columns).
// type : "text", "long" (plusieurs lignes), "url", "email", "tel" (cliquables), "image" (une seule par ligne).
// card : affichée sur la carte (la première colonne texte est toujours le titre).
export const COLUMNS = [
  { key: "materiel", label: "Matériel / Marque", type: "text", required: true },
  { key: "photo", label: "Photo", type: "image" },
  { key: "conditionnement", label: "Conditionnement", type: "text", card: true },
  { key: "quantite", label: "Quantité", type: "text", card: true },
  { key: "reference", label: "Référence", type: "text" },
  { key: "lien", label: "Lien fournisseur", type: "url" },
  { key: "lieu", label: "Lieu", type: "text", card: true },
  { key: "contact", label: "Contact", type: "text" },
  { key: "mail", label: "Mail", type: "email" },
  { key: "tel", label: "Tel", type: "tel" },
];

export const TEXT_MAX = 2000;
export const IMAGE_MAX = 1_500_000; // octets, après réduction dans le navigateur
