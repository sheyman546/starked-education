const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const auth = require('../middleware/auth');
const Content = require('../models/Content');

// Stream video content with range request support
router.get('/video/:filename', auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../media/videos', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = await fs.open(filePath);
      const stream = file.createReadStream({ start, end });
      
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      
      res.writeHead(206, head);
      stream.pipe(res);
      
      stream.on('end', () => {
        file.close();
      });
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      const file = await fs.open(filePath);
      const stream = file.createReadStream();
      stream.pipe(res);
      
      stream.on('end', () => {
        file.close();
      });
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

// Stream audio content
router.get('/audio/:filename', auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../media/audio', filename);
    
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Audio not found' });
    }
    
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = await fs.open(filePath);
      const stream = file.createReadStream({ start, end });
      
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      
      res.writeHead(206, head);
      stream.pipe(res);
      
      stream.on('end', () => {
        file.close();
      });
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      const file = await fs.open(filePath);
      const stream = file.createReadStream();
      stream.pipe(res);
      
      stream.on('end', () => {
        file.close();
      });
    }
  } catch (error) {
    console.error('Error streaming audio:', error);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

// Serve documents
router.get('/document/:filename', auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../media/documents', filename);
    
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.doc':
      case '.docx':
        contentType = 'application/msword';
        break;
      case '.ppt':
      case '.pptx':
        contentType = 'application/vnd.ms-powerpoint';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({ error: 'Failed to serve document' });
  }
});

// Serve images
router.get('/image/:filename', auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../media/images', filename);
    
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Serve subtitles
router.get('/subtitle/:filename', auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../media/subtitles', filename);
    
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Subtitle not found' });
    }
    
    res.setHeader('Content-Type', 'text/vtt');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving subtitle:', error);
    res.status(500).json({ error: 'Failed to serve subtitle' });
  }
});

// Serve transcripts
router.get('/transcript/:filename', auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../media/transcripts', filename);
    
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving transcript:', error);
    res.status(500).json({ error: 'Failed to serve transcript' });
  }
});

// Get media metadata for HLS streaming
router.get('/hls/:contentId/:quality', auth, async (req, res) => {
  try {
    const { contentId, quality } = req.params;
    
    const content = await Content.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Find the video file with requested quality
    const videoFile = content.files.find(f => f.type === 'video' && f.quality === quality);
    if (!videoFile) {
      return res.status(404).json({ error: 'Video quality not available' });
    }
    
    // Generate HLS playlist (simplified version)
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
${videoFile.url}
#EXT-X-ENDLIST`;
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(playlist);
  } catch (error) {
    console.error('Error generating HLS playlist:', error);
    res.status(500).json({ error: 'Failed to generate HLS playlist' });
  }
});

// Upload media chunk (for large file uploads)
router.post('/upload/chunk', auth, async (req, res) => {
  try {
    const { fileName, chunkIndex, totalChunks, chunkData, contentType } = req.body;
    
    const uploadDir = contentType.startsWith('video/') ? 'media/videos/' :
                     contentType.startsWith('audio/') ? 'media/audio/' :
                     contentType.startsWith('image/') ? 'media/images/' :
                     'media/documents/';
    
    const tempDir = path.join(__dirname, '../temp/uploads');
    const chunkPath = path.join(tempDir, `${fileName}.chunk.${chunkIndex}`);
    
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });
    
    // Save chunk
    const buffer = Buffer.from(chunkData, 'base64');
    await fs.writeFile(chunkPath, buffer);
    
    // Check if all chunks are uploaded
    const chunksUploaded = await fs.readdir(tempDir);
    const relevantChunks = chunksUploaded.filter(f => f.includes(fileName));
    
    if (relevantChunks.length === parseInt(totalChunks)) {
      // Merge chunks
      const finalPath = path.join(__dirname, '../', uploadDir, fileName);
      const writeStream = require('fs').createWriteStream(finalPath);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `${fileName}.chunk.${i}`);
        const chunkData = await fs.readFile(chunkPath);
        writeStream.write(chunkData);
        await fs.unlink(chunkPath); // Remove chunk
      }
      
      writeStream.end();
      
      res.json({ 
        status: 'completed', 
        url: `/${uploadDir}${fileName}` 
      });
    } else {
      res.json({ 
        status: 'uploading', 
        progress: (relevantChunks.length / totalChunks) * 100 
      });
    }
  } catch (error) {
    console.error('Error uploading chunk:', error);
    res.status(500).json({ error: 'Failed to upload chunk' });
  }
});

module.exports = router;
