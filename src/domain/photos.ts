import photos from "../../public/assets/photos/credits.json";

export type Photo = (typeof photos)[number];
export const nigeriaPhotos = photos;
export function photoForCategory(category: string) {
  return (
    photos.find((photo) => photo.categories.includes(category)) ?? photos[0]
  );
}
