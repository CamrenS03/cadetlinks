import { Box, CssBaseline, Typography } from "@mui/material";
import AppTheme from "../shared-theme/AppTheme";
import { AppContainer } from "../shared-theme/AppContainer";
import AppHeader from "../shared-theme/Header";

export default function DocumentExplorer(props: { disableCustomTheme?: boolean }) {
    return (
            <AppTheme {...props}>
                <CssBaseline enableColorScheme />
                <AppContainer direction="column" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <AppHeader />
                    <Box sx={{ flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}>
                        <Typography>Documents</Typography>
                    </Box>
                </AppContainer>
            </AppTheme>
        )
}