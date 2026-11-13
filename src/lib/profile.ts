export interface Profile {
  name: string;
  location: string;
}

export type ProfileErrors = Partial<Record<keyof Profile, string>>;

export function validateProfileField(field: keyof Profile, value: string): string | undefined {
  const label = field === "name" ? "name" : "location";
  const cleanValue = value.trim();
  if (!cleanValue) return `Please enter your ${label}.`;
  if (/\p{N}/u.test(cleanValue)) return `Your ${label} cannot contain numbers.`;
}

export function validateProfile(profile: Profile): ProfileErrors {
  const errors: ProfileErrors = {};
  const nameError = validateProfileField("name", profile.name);
  const locationError = validateProfileField("location", profile.location);
  if (nameError) errors.name = nameError;
  if (locationError) errors.location = locationError;
  return errors;
}
