// The predefined Dhaka areas. One lat/lng point per area (roughly its centre).
// This list is the single source of truth: the seed writes it to the `areas`
// table, and docs/domain.md shows the same numbers.
export const DHAKA_AREAS = [
  { id: 'uttara', name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { id: 'bashundhara', name: 'Bashundhara', lat: 23.8193, lng: 90.4526 },
  { id: 'mirpur', name: 'Mirpur', lat: 23.8223, lng: 90.3654 },
  { id: 'banani', name: 'Banani', lat: 23.7937, lng: 90.4066 },
  { id: 'gulshan-2', name: 'Gulshan 2', lat: 23.7949, lng: 90.4143 },
  { id: 'gulshan-1', name: 'Gulshan 1', lat: 23.7806, lng: 90.4163 },
  { id: 'mohakhali', name: 'Mohakhali', lat: 23.7781, lng: 90.4 },
  { id: 'badda', name: 'Badda', lat: 23.7806, lng: 90.4262 },
  { id: 'tejgaon', name: 'Tejgaon', lat: 23.7639, lng: 90.3925 },
  { id: 'farmgate', name: 'Farmgate', lat: 23.7577, lng: 90.3897 },
  { id: 'dhanmondi', name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  { id: 'motijheel', name: 'Motijheel', lat: 23.733, lng: 90.4172 },
];
