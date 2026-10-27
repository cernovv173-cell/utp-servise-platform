package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.orderItemTypeLabel

@Composable
fun TechnicianCatalogScreen(catalogItems: List<CatalogItem>) {
    var search by remember { mutableStateOf("") }
    val items = catalogItems.filter { item ->
        item.active && (search.isBlank() || item.name.contains(search, ignoreCase = true))
    }

    Column(
        modifier = Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Каталог", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Справочник услуг, товаров и запчастей.", fontSize = 13.sp, color = UtpMuted)
        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            label = { Text("Поиск по названию") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
        )
        if (items.isEmpty()) {
            Text("Подходящих позиций пока нет.", color = UtpMuted)
        }
        items.forEach { item ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(item.type.orderItemTypeLabel(), fontSize = 11.sp, color = UtpMuted)
                    Text(item.name, fontWeight = FontWeight.SemiBold, color = UtpInk)
                    item.description?.takeIf(String::isNotBlank)?.let {
                        Text(it, fontSize = 13.sp, color = UtpMuted)
                    }
                    Text("${item.unitPriceRub} ₽", fontWeight = FontWeight.SemiBold, color = UtpBlue)
                }
            }
        }
    }
}
