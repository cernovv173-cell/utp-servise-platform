package ru.utp.servise.ui

internal fun canSubmitShopOrder(
    cartLineCount: Int,
    hasUnavailableItem: Boolean,
    isLoading: Boolean,
    hasLoadError: Boolean,
    isSubmitting: Boolean,
    deliveryMethod: String,
    deliveryCity: String,
    deliveryAddress: String,
): Boolean =
    cartLineCount > 0 &&
        !hasUnavailableItem &&
        !isLoading &&
        !hasLoadError &&
        !isSubmitting &&
        (deliveryMethod != "COURIER" ||
            (deliveryCity.isNotBlank() && deliveryAddress.isNotBlank()))
