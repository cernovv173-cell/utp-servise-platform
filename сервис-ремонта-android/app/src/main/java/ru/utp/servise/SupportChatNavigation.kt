package ru.utp.servise

import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.SupportChat
import ru.utp.servise.data.SupportChatInboxItem
import ru.utp.servise.ui.RunAction
import ru.utp.servise.ui.SupportChatInboxScreen
import ru.utp.servise.ui.SupportChatScreen

internal fun NavGraphBuilder.addSupportChatRoutes(
    role: String,
    userId: String,
    token: String,
    supportChats: List<SupportChatInboxItem>,
    activeSupportChat: SupportChat?,
    busy: Boolean,
    runAction: RunAction,
    onChatUpdated: (SupportChat) -> Unit,
    onRefreshChat: (String?) -> Unit,
    onRefreshInbox: () -> Unit,
    onOpenAdminChat: (String) -> Unit,
    onBack: () -> Unit,
) {
    when (role) {
        "CUSTOMER" -> composable("customer/support-chat") {
            SupportChatScreen(
                customerId = userId,
                isAdministrator = false,
                chat = activeSupportChat,
                busy = busy,
                onRefresh = { onRefreshChat(null) },
                onSendMessage = { content, onSent ->
                    runAction({ ApiClient.sendSupportChatMessage(token, content) }) { result ->
                        (result as? SupportChat)?.let(onChatUpdated)
                        onSent()
                    }
                },
                onBack = onBack,
            )
        }

        "ADMIN" -> {
            composable("admin/support-chats") {
                SupportChatInboxScreen(
                    chats = supportChats,
                    refresh = onRefreshInbox,
                    onOpenChat = onOpenAdminChat,
                    onBack = onBack,
                )
            }
            composable("admin/support-chat/{customerId}") { entry ->
                val customerId = entry.arguments?.getString("customerId").orEmpty()
                SupportChatScreen(
                    customerId = customerId,
                    isAdministrator = true,
                    chat = activeSupportChat,
                    busy = busy,
                    onRefresh = { onRefreshChat(customerId) },
                    onSendMessage = { content, onSent ->
                        runAction({ ApiClient.sendAdministratorSupportMessage(token, customerId, content) }) { result ->
                            (result as? SupportChat)?.let(onChatUpdated)
                            onSent()
                        }
                    },
                    onBack = onBack,
                )
            }
        }
    }
}
