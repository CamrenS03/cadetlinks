import React, { useState, useEffect } from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  Alert,
  CssBaseline,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import AppTheme from '../../shared-theme/AppTheme';
import AppHeader from '../../shared-theme/Header';
import { AppContainer } from '../../shared-theme/AppContainer';
import { useUser } from '../../hooks/useUser';
import { useAuth } from '../../firebase/AuthContext';
import { db, storage } from '../../firebase/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

interface DocItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  pocOnly?: boolean;
  downloadURL?: string;
  storagePath?: string;
  uploadedBy?: string;
  createdAt?: any;
}

interface BreadCrumbEntry {
  id: string | null;
  name: string;
}

export default function DocumentExplorer(props: { disableCustomTheme?: boolean }) {
  const { currentUser } = useAuth();
  const { userJob, userData } = useUser();
  const canManage = userJob?.permissions?.includes('manage_documents') ?? false;
  const isPOC = userData?.flight === 'POC';

  const [items, setItems] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadCrumbEntry[]>([
    { id: null, name: 'Documents' },
  ]);

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuItem, setMenuItem] = useState<DocItem | null>(null);

  // Dialogs
  const [openNewFolder, setOpenNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [openRename, setOpenRename] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [openPDF, setOpenPDF] = useState(false);
  const [pdfItem, setPdfItem] = useState<DocItem | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Fetch items in current folder
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'documentMetadata'), where('parentId', '==', currentFolderId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DocItem));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Failed to load documents');
        setLoading(false);
      }
    );
    return unsub;
  }, [currentFolderId]);

  const filtered = items.filter(
    (item) => item.name.toLowerCase().includes(search.toLowerCase()) && (!item.pocOnly || isPOC)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const navigateInto = (folder: DocItem) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSearch('');
  };

  const navigateTo = (index: number) => {
    const entry = breadcrumbs[index];
    setCurrentFolderId(entry.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setSearch('');
  };

  const handleItemClick = (item: DocItem) => {
    if (item.type === 'folder') {
      navigateInto(item);
    } else {
      setPdfItem(item);
      setOpenPDF(true);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, item: DocItem) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuItem(item);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentUser) return;
    try {
      await addDoc(collection(db, 'documentMetadata'), {
        name: newFolderName.trim(),
        type: 'folder',
        parentId: currentFolderId,
        uploadedBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      setNewFolderName('');
      setOpenNewFolder(false);
    } catch (err) {
      console.error(err);
      setError('Failed to create folder');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    const path = `documents/${currentFolderId ?? 'root'}/${Date.now()}_${file.name}`;
    const storageref = ref(storage, path);
    const task = uploadBytesResumable(storageref, file);
    task.on(
      'state_changed',
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        console.error(err);
        setError('Upload failed');
        setUploadProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, 'documentMetadata'), {
          name: file.name,
          type: 'file',
          parentId: currentFolderId,
          downloadURL: url,
          storagePath: path,
          uploadedBy: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        setUploadProgress(null);
      }
    );
    e.target.value = '';
  };

  const handleRename = async () => {
    if (!menuItem || !renameName.trim()) return;
    try {
      await updateDoc(doc(db, 'documentMetadata', menuItem.id), { name: renameName.trim() });
      setOpenRename(false);
      setRenameName('');
    } catch (err) {
      console.error(err);
      setError('Failed to rename');
    }
  };

  const handleDelete = async () => {
    if (!menuItem) return;
    try {
      if (menuItem.storagePath) {
        await deleteObject(ref(storage, menuItem.storagePath));
      }
      await deleteDoc(doc(db, 'documentMetadata', menuItem.id));
      setOpenDeleteConfirm(false);
      if (openPDF && pdfItem?.id === menuItem.id) setOpenPDF(false);
    } catch (err) {
      console.error(err);
      setError('Failed to delete');
    }
  };

  const fileIcon = (item: DocItem) => {
    if (item.type === 'folder') return <FolderIcon color="warning" />;
    if (item.name.toLowerCase().endsWith('.pdf')) return <PictureAsPdfIcon color="error" />;
    return <InsertDriveFileIcon color="action" />;
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <AppContainer direction="column" sx={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        <AppHeader />

        <Box sx={{ width: '100%', maxWidth: 800, mt: 2, px: 2 }}>
          {/* Breadcrumbs */}
          <Breadcrumbs sx={{ mb: 2 }}>
            {breadcrumbs.map((crumb, i) =>
              i < breadcrumbs.length - 1 ? (
                <Link
                  key={crumb.id ?? 'root'}
                  component="button"
                  underline="hover"
                  color="inherit"
                  onClick={() => navigateTo(i)}
                >
                  {crumb.name}
                </Link>
              ) : (
                <Typography key={crumb.id ?? 'root'} color="text.primary">
                  {crumb.name}
                </Typography>
              )
            )}
          </Breadcrumbs>

          {/* Toolbar */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {canManage && (
              <>
                <Tooltip title="New Folder">
                  <IconButton onClick={() => setOpenNewFolder(true)}>
                    <CreateNewFolderIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Upload File">
                  <IconButton component="label">
                    <UploadFileIcon />
                    <input type="file" hidden onChange={handleUpload} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>

          {uploadProgress !== null && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Uploading... {uploadProgress}%
            </Alert>
          )}
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}

          {/* File List */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          ) : sorted.length === 0 ? (
            <Typography color="textSecondary" sx={{ mt: 4, textAlign: 'center' }}>
              {search ? 'No matches' : 'This folder is empty'}
            </Typography>
          ) : (
            <List disablePadding>
              {sorted.map((item) => (
                <ListItem
                  key={item.id}
                  disablePadding
                  divider
                  secondaryAction={
                    canManage ? (
                      <IconButton edge="end" size="small" onClick={(e) => handleMenuOpen(e, item)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    ) : undefined
                  }
                >
                  <ListItemButton onClick={() => handleItemClick(item)}>
                    <ListItemIcon sx={{ minWidth: 36 }}>{fileIcon(item)}</ListItemIcon>
                    <ListItemText primary={item.name} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Context Menu */}
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
          <MenuItem
            onClick={() => {
              setRenameName(menuItem?.name ?? '');
              setOpenRename(true);
              handleMenuClose();
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpenDeleteConfirm(true);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            Delete
          </MenuItem>
        </Menu>

        {/* New Folder Dialog */}
        <Dialog
          open={openNewFolder}
          onClose={() => setOpenNewFolder(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>New Folder</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenNewFolder(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} variant="contained">
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={openRename} onClose={() => setOpenRename(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Rename</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="New name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenRename(false)}>Cancel</Button>
            <Button onClick={handleRename} variant="contained">
              Rename
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
          <DialogTitle>Delete "{menuItem?.name}"?</DialogTitle>
          <DialogContent>
            <Typography>This cannot be undone.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteConfirm(false)}>Cancel</Button>
            <Button onClick={handleDelete} variant="contained">
              Rename
            </Button>
          </DialogActions>
        </Dialog>

        {/* PDF Viewer */}
        <Dialog open={openPDF} onClose={() => setOpenPDF(false)} maxWidth="lg" fullWidth>
          <DialogTitle
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography noWrap sx={{ flex: 1, mr: 1 }}>
              {pdfItem?.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              {pdfItem?.downloadURL && (
                <Tooltip title="Download">
                  <IconButton
                    component="a"
                    href={pdfItem.downloadURL}
                    download={pdfItem.name}
                    target="_blank"
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton onClick={() => setOpenPDF(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0, height: '80vh' }}>
            {pdfItem?.downloadURL && (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfItem.downloadURL)}&embedded=true`}
                title={pdfItem.name}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
              />
            )}
          </DialogContent>
        </Dialog>
      </AppContainer>
    </AppTheme>
  );
}
