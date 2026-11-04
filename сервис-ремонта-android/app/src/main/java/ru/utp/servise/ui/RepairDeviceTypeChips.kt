package ru.utp.servise.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.utp.servise.data.deviceLabel

internal val repairDeviceTypes = listOf("COMPUTER", "LAPTOP", "PHONE", "TABLET")
internal const val ALL_REPAIR_DEVICE_TYPES = "ALL"

@Composable
internal fun RepairDeviceTypePicker(
    selected: Set<String>,
    onToggle: (String) -> Unit,
) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        repairDeviceTypes.forEach { deviceType ->
            FilterChip(
                selected = deviceType in selected,
                onClick = { onToggle(deviceType) },
                label = { Text(deviceType.deviceLabel()) },
            )
        }
    }
}

@Composable
internal fun RepairDeviceTypeFilter(
    selected: String,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        (listOf(ALL_REPAIR_DEVICE_TYPES) + repairDeviceTypes).forEach { deviceType ->
            FilterChip(
                selected = deviceType == selected,
                onClick = { onSelect(deviceType) },
                label = { Text(if (deviceType == ALL_REPAIR_DEVICE_TYPES) "Все" else deviceType.deviceLabel()) },
            )
        }
    }
}
