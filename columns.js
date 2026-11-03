// Les colonnes de la liste. Une seule source : le serveur valide avec, la page s'affiche avec (/api/columns).
// type : "text" (une ligne), "long" (plusieurs lignes), "image" (une seule par ligne).
// À REMPLACER par les 10 colonnes du fichier Excel.
export const COLUMNS = [
  { key: "image", label: "Photo", type: "image" },
  { key: "nom", label: "Nom", type: "text", required: true },
  { key: "categorie", label: "Catégorie", type: "text" },
  { key: "etat", label: "État", type: "text" },
  { key: "lieu", label: "Lieu", type: "text" },
  { key: "quantite", label: "Quantité", type: "text" },
  { key: "dimensions", label: "Dimensions", type: "text" },
  { key: "contact", label: "Contact", type: "text" },
  { key: "dispo", label: "Disponible à partir de", type: "text" },
  { key: "description", label: "Description", type: "long" },
];

export const TEXT_MAX = 2000;
export const IMAGE_MAX = 1_500_000; // octets, après réduction dans le navigateur
