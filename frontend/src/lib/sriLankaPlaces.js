/**
 * Approximate [lat, lng] for Sri Lankan towns, for map pins only — the
 * cities/districts tables carry names but no coordinates. Unknown cities
 * fall back to their district's main town, then to the island centre.
 */
const PLACES = {
  // District capitals (also the district fallbacks)
  colombo: [6.9271, 79.8612],
  gampaha: [7.0917, 79.9999],
  kalutara: [6.5854, 79.9607],
  kandy: [7.2906, 80.6337],
  matale: [7.4675, 80.6234],
  "nuwara eliya": [6.9497, 80.7891],
  galle: [6.0535, 80.221],
  matara: [5.9549, 80.555],
  hambantota: [6.1241, 81.1185],
  jaffna: [9.6615, 80.0255],
  kilinochchi: [9.3803, 80.377],
  mannar: [8.981, 79.9044],
  vavuniya: [8.7514, 80.4971],
  mullaitivu: [9.2671, 80.8142],
  batticaloa: [7.731, 81.6747],
  ampara: [7.2975, 81.682],
  trincomalee: [8.5874, 81.2152],
  kurunegala: [7.4863, 80.3647],
  puttalam: [8.0362, 79.8283],
  anuradhapura: [8.3114, 80.4037],
  polonnaruwa: [7.9403, 81.0188],
  badulla: [6.9934, 81.055],
  monaragala: [6.8728, 81.3507],
  moneragala: [6.8728, 81.3507],
  ratnapura: [6.6828, 80.3992],
  kegalle: [7.2513, 80.3464],

  // Other common towns
  negombo: [7.2083, 79.8358],
  "mount lavinia": [6.8389, 79.8653],
  dehiwala: [6.8511, 79.8659],
  moratuwa: [6.773, 79.8816],
  "sri jayawardenepura kotte": [6.8905, 79.902],
  kotte: [6.8905, 79.902],
  maharagama: [6.848, 79.9265],
  nugegoda: [6.8649, 79.8997],
  battaramulla: [6.8995, 79.9188],
  kadawatha: [7.0016, 79.9533],
  "ja-ela": [7.0744, 79.8919],
  wattala: [6.9897, 79.8917],
  katunayake: [7.1697, 79.8883],
  panadura: [6.7133, 79.9026],
  beruwala: [6.4788, 79.9828],
  bentota: [6.421, 80.0],
  hikkaduwa: [6.1395, 80.1063],
  unawatuna: [6.01, 80.249],
  mirissa: [5.9483, 80.4716],
  weligama: [5.9749, 80.4295],
  tangalle: [6.0243, 80.7942],
  tissamaharama: [6.2785, 81.2876],
  ella: [6.8667, 81.0466],
  bandarawela: [6.8259, 80.9982],
  haputale: [6.7656, 80.9581],
  dambulla: [7.8742, 80.6511],
  sigiriya: [7.957, 80.7603],
  kalmunai: [7.4167, 81.8167],
  "arugam bay": [6.84, 81.836],
  pottuvil: [6.8761, 81.8327],
  chilaw: [7.5758, 79.7953],
  kalpitiya: [8.2333, 79.7667],
  peradeniya: [7.2599, 80.5977],
  gampola: [7.1643, 80.5696],
  katugastota: [7.3167, 80.6167],
  avissawella: [6.9533, 80.2047],
  embilipitiya: [6.3439, 80.8489],
  kuliyapitiya: [7.4688, 80.0401],
  horana: [6.7159, 80.0626],
  "point pedro": [9.8167, 80.2333],
};

export const SRI_LANKA_CENTER = [7.8731, 80.7718];

const key = (s) => String(s ?? "").trim().toLowerCase();

/** [lat, lng] for a city, else its district's main town, else null. */
export function placeCoords(city, district) {
  return PLACES[key(city)] ?? PLACES[key(district)] ?? null;
}
