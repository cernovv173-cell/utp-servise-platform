package ru.utp.servise.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShopCheckoutPolicyTest {
    @Test
    fun `allows a valid pickup order after the catalog loads`() {
        assertTrue(
            canSubmitShopOrder(
                cartLineCount = 1,
                hasUnavailableItem = false,
                isLoading = false,
                hasLoadError = false,
                isSubmitting = false,
                deliveryMethod = "PICKUP",
                deliveryCity = "",
                deliveryAddress = "",
            ),
        )
    }

    @Test
    fun `blocks checkout during loading after a load error or while submitting`() {
        assertFalse(canSubmitShopOrder(1, false, true, false, false, "PICKUP", "", ""))
        assertFalse(canSubmitShopOrder(1, false, false, true, false, "PICKUP", "", ""))
        assertFalse(canSubmitShopOrder(1, false, false, false, true, "PICKUP", "", ""))
    }

    @Test
    fun `requires at least one line and all items to be available`() {
        assertFalse(canSubmitShopOrder(0, false, false, false, false, "PICKUP", "", ""))
        assertFalse(canSubmitShopOrder(1, true, false, false, false, "PICKUP", "", ""))
    }

    @Test
    fun `courier checkout requires both city and address`() {
        assertFalse(canSubmitShopOrder(1, false, false, false, false, "COURIER", "Пушкино", ""))
        assertTrue(
            canSubmitShopOrder(
                1,
                false,
                false,
                false,
                false,
                "COURIER",
                "Пушкино",
                "Улица, дом",
            ),
        )
    }
}
