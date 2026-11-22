package ru.utp.servise

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.AppUser
import ru.utp.servise.data.CustomerBusinessProfile
import ru.utp.servise.data.CustomerDevice
import ru.utp.servise.data.CustomerServicePrice
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.RepairOrderIntakeInput
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.ui.CustomerBusinessHomeScreen
import ru.utp.servise.ui.CustomerDevicesScreen
import ru.utp.servise.ui.RepairOrderIntakeNotice
import ru.utp.servise.ui.RepairOrdersScreen
import ru.utp.servise.ui.RepairRequestForm
import ru.utp.servise.ui.RunAction
import ru.utp.servise.ui.compressSelectedImage

internal fun NavGraphBuilder.registerCustomerBusinessRoutes(
    navController: NavHostController,
    user: AppUser,
    token: String,
    profile: CustomerBusinessProfile?,
    devices: List<CustomerDevice>,
    orders: List<RepairOrder>,
    servicePrices: List<CustomerServicePrice>,
    banners: List<SiteBanner>,
    acceptingNewOrders: Boolean?,
    busy: Boolean,
    runAction: RunAction,
    refresh: () -> Unit,
    onError: (String) -> Unit,
    onCampaignNavigate: (String) -> Unit,
) {
    composable("customer/business") {
        CustomerBusinessHomeScreen(
            profile = profile,
            deviceCount = devices.size,
            orderCount = orders.size,
            busy = busy,
            onBack = { navController.popBackStack() },
            onSaveProfile = { companyName ->
                runAction({ ApiClient.saveCustomerBusinessProfile(token, companyName) }) { }
            },
            onOpenDevices = { navController.navigate("customer/business/devices") },
            onOpenOrders = { navController.navigate("customer/business/orders") },
            onNewOrder = { navController.navigate("customer/business/new-order") },
        )
    }

    composable("customer/business/devices") {
        CustomerDevicesScreen(
            devices = devices,
            onRepeat = { deviceId ->
                navController.currentBackStackEntry?.savedStateHandle?.set(
                    "businessRepeatDeviceId",
                    deviceId,
                )
                navController.navigate("customer/business/new-order") {
                    launchSingleTop = true
                }
            },
            onCreate = { type, nickname, brand, model, serial, date, note ->
                runAction({
                    ApiClient.createCustomerDevice(
                        token,
                        type,
                        nickname,
                        brand,
                        model,
                        serial,
                        date,
                        note,
                        scope = "business",
                    )
                }) { }
            },
            onWarrantyClaim = { originalOrderId, problem ->
                runAction({ ApiClient.createWarrantyClaim(token, originalOrderId, problem) }) { result ->
                    (result as? RepairOrder)?.id?.let { navController.navigate("chat/$it") }
                }
            },
            onSaveReminder = { deviceId, date, note ->
                runAction({
                    ApiClient.updateCustomerDeviceReminder(
                        token,
                        deviceId,
                        date,
                        note,
                        scope = "business",
                    )
                }) { }
            },
            onDelete = { deviceId ->
                runAction({ ApiClient.deleteCustomerDevice(token, deviceId, scope = "business") }) { }
            },
            busy = busy,
            isBusiness = true,
            onBack = { navController.popBackStack() },
        )
    }

    composable("customer/business/orders") {
        RepairOrdersScreen(
            title = "Заявки компании",
            orders = orders,
            role = user.role,
            token = token,
            technicians = emptyList(),
            catalogItems = emptyList(),
            historyOnly = false,
            runAction = runAction,
            refresh = refresh,
            onChat = { navController.navigate("chat/$it") },
            onReview = { orderId -> navController.navigate("customer/review/$orderId") },
            headerContent = {
                TextButton(onClick = { navController.popBackStack() }) { Text("← В кабинет компании") }
            },
        )
    }

    composable("customer/business/new-order") {
        val context = LocalContext.current
        val repeatDeviceId = navController.previousBackStackEntry
            ?.savedStateHandle
            ?.get<String>("businessRepeatDeviceId")
        when {
            profile == null -> Column(
                Modifier.fillMaxSize().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                TextButton(onClick = { navController.popBackStack() }) { Text("← Назад") }
                Text("Сначала создайте профиль компании в корпоративном кабинете.")
                Button(onClick = { navController.navigate("customer/business") }) {
                    Text("Открыть корпоративный кабинет")
                }
            }

            acceptingNewOrders == false -> Column(
                Modifier.fillMaxSize().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                TextButton(onClick = { navController.popBackStack() }) { Text("← Назад") }
                RepairOrderIntakeNotice()
            }

            else -> RepairRequestForm(
                initialPhone = user.phoneNumber.orEmpty(),
                onBack = { navController.popBackStack() },
                banners = banners,
                token = token,
                customerDevices = devices,
                servicePrices = servicePrices,
                initialDeviceId = repeatDeviceId,
                onCampaignNavigate = onCampaignNavigate,
                onSubmit = { deviceType, problem, address, details, photoUri ->
                    runAction({
                        val order = ApiClient.createOrder(
                            token,
                            RepairOrderIntakeInput(
                                deviceType,
                                problem,
                                address,
                                details,
                                businessOrder = true,
                            ),
                        )
                        photoUri?.let { uri ->
                            runCatching {
                                ApiClient.uploadOrderPhoto(
                                    token,
                                    order.id,
                                    compressSelectedImage(context, uri),
                                )
                            }.onFailure {
                                onError("Заявка создана, но фото не загрузилось. Его можно добавить в карточке заявки.")
                            }
                        }
                        order
                    }) {
                        navController.previousBackStackEntry
                            ?.savedStateHandle
                            ?.remove<String>("businessRepeatDeviceId")
                        navController.popBackStack()
                    }
                },
                busy = busy,
            )
        }
    }
}
