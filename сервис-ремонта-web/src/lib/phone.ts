const allowedPhonePattern = /^[+0-9().\-\s]+$/;
const maxPhoneLength = 32;

export const phoneNumberPlaceholder = "+7 999 123-45-67";

export const isValidPhoneNumber = (value: string) => {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > maxPhoneLength ||
    !allowedPhonePattern.test(trimmed)
  ) {
    return false;
  }
  const digitCount = trimmed.replace(/\D/g, "").length;
  return digitCount >= 7 && digitCount <= 15;
};

export const getPhoneNumberError = (value: string, options: { required: boolean }) => {
  if (value.trim().length === 0) {
    return options.required ? "Укажите номер телефона." : null;
  }
  return isValidPhoneNumber(value) ? null : "Введите корректный номер телефона.";
};
