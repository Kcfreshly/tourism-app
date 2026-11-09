import photos from "../../../../public/assets/photos/credits.json";

export type Photo = (typeof photos)[number];
export const nigeriaPhotos = photos;
export function photoById(id: string) {
  return photos.find((photo) => photo.id === id) ?? photos[0];
}
export function photoForCategory(category: string) {
  return (
    photos.find((photo) => photo.categories.includes(category)) ?? photos[0]
  );
}
export function photoForExperience(seedKey: string, category: string) {
  return (
    photos.find((photo) => photo.experiences?.includes(seedKey)) ??
    photoForCategory(category)
  );
}
