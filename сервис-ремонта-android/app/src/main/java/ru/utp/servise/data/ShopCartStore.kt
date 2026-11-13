package ru.utp.servise.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

private const val SHOP_CART_PREFERENCES = "utp_shop_cart"

fun readShopCart(context: Context, customerId: String): Map<String, Int> {
    val preferences = context.getSharedPreferences(SHOP_CART_PREFERENCES, Context.MODE_PRIVATE)
    val saved = preferences.getString(customerId, null) ?: return emptyMap()
    return runCatching {
        val json = JSONObject(saved)
        buildMap {
            val keys = json.keys()
            while (keys.hasNext()) {
                val id = keys.next()
                val quantity = json.optInt(id, 0)
                if (id.isNotBlank() && quantity in 1..100) put(id, quantity)
            }
        }
    }.getOrDefault(emptyMap())
}

fun saveShopCart(context: Context, customerId: String, cart: Map<String, Int>) {
    val json = JSONObject()
    cart.forEach { (id, quantity) ->
        if (id.isNotBlank() && quantity in 1..100) json.put(id, quantity)
    }
    context.getSharedPreferences(SHOP_CART_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .putString(customerId, json.toString())
        .apply()
}

fun observeShopCart(
    context: Context,
    customerId: String,
    onChange: (Map<String, Int>) -> Unit,
): () -> Unit {
    val preferences = context.getSharedPreferences(SHOP_CART_PREFERENCES, Context.MODE_PRIVATE)
    val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, changedCustomerId ->
        if (changedCustomerId == customerId) onChange(readShopCart(context, customerId))
    }
    preferences.registerOnSharedPreferenceChangeListener(listener)
    return { preferences.unregisterOnSharedPreferenceChangeListener(listener) }
}

fun clearShopCart(context: Context, customerId: String) {
    context.getSharedPreferences(SHOP_CART_PREFERENCES, Context.MODE_PRIVATE)
        .edit()
        .remove(customerId)
        .apply()
}
