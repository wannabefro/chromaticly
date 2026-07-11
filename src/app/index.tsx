// Route file — thin by design. Screen implementation and its tests live in
// src/screens (outside expo-router's route scan, which would otherwise bundle
// colocated *.test.tsx as routes and pull test-only deps into the app).
export { default } from '../screens/HomeScreen';
