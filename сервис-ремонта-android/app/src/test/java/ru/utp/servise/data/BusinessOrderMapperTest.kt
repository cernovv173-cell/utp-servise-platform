package ru.utp.servise.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class BusinessOrderMapperTest {
    @Test
    fun `repair order mapper keeps company association and name`() {
        val profileId = "11111111-1111-4111-8111-111111111111"
        val order = JSONObject()
            .put("id", "22222222-2222-4222-8222-222222222222")
            .put("deviceType", "LAPTOP")
            .put("problem", "Не включается")
            .put("address", "Пушкино")
            .put("status", "REQUESTED")
            .put("businessProfileId", profileId)
            .put("businessProfile", JSONObject().put("id", profileId).put("companyName", "ООО Альфа"))
            .toOrder()

        assertEquals(profileId, order.businessProfileId)
        assertEquals("ООО Альфа", order.businessProfileCompanyName)
    }

    @Test
    fun `company profile mapper reads profile returned by API`() {
        val profile = JSONObject()
            .put("id", "33333333-3333-4333-8333-333333333333")
            .put("companyName", "ООО Альфа")
            .put("createdAt", "2026-11-22T12:00:00.000Z")
            .put("updatedAt", "2026-11-22T12:00:00.000Z")
            .toCustomerBusinessProfile()

        assertEquals("ООО Альфа", profile.companyName)
    }
}
