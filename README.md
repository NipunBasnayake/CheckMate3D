# **Checkmate 3D**

## **Overview**
Checkmate 3D is an interactive chess game built using Three.js. It provides a 3D chessboard with movable pieces, realistic lighting, and smooth animations. The game enables players to select, move, and interact with chess pieces dynamically.

---

## **Features**
- **3D Chessboard & Pieces**:
  - Fully rendered 3D chessboard with detailed pieces.
  - Real-time piece selection and movement.
- **Interactive Controls**:
  - Orbit camera for an immersive view.
  - Click-based piece selection and movement.
- **Lighting & Shadows**:
  - Directional and ambient lighting for realistic visuals.
  - Shadows enabled for depth perception.
- **Smooth Animations**:
  - Smooth piece movement animations.
  - Highlighting for selected pieces.

---

## **Technologies Used**
- **3D Rendering**: Three.js
- **Controls**: OrbitControls for smooth camera movement
- **Model Loading**: GLTFLoader for importing 3D models
- **Event Handling**: JavaScript event listeners for user interactions
- **Shading & Lighting**: Three.js material properties and lights

---

## **Project Status**
- **In Progress**: Enhancing piece movement logic and implementing game rules.

---

## **Usage**

### **Basic Controls**
1. **Camera Navigation**:
   - Drag to rotate the camera.
   - Zoom in and out using the scroll wheel.
2. **Selecting a Piece**:
   - Click on a piece to select it.
   - The selected piece is highlighted.
3. **Moving a Piece**:
   - Click on a square to move the selected piece.
   - Pieces move with smooth animations.
4. **Deselecting a Piece**:
   - Click on the selected piece again to deselect it.

### **Chessboard & Pieces**
- The board consists of 8x8 squares, labeled using file and rank notation.
- Pieces include pawns, knights, bishops, rooks, queens, and kings for both black and white.

### **Raycasting for Selection**
- Raycaster detects mouse clicks on pieces and squares.
- Ensures accurate selection and movement detection.

---

## **Screenshots**
![Chessboard](Screenshots/Chessboard.png)
![Piece Selection](Screenshots/Select.png)
![Movement Animation](Screenshots/Move.png)

---

## **Contributing**
Contributions are welcome! To contribute:
- Fork the repository.
- Implement features or fix issues.
- Submit a pull request.

---

## **License**
This project is licensed under the MIT License. See the LICENSE file for more details.

---

## **Credits**
- **Developer**: Nipun Basnayake  
- **Special Thanks**: Sharada Marasinghe for valuable guidance and support.  
- **Libraries Used**:
  - Three.js for 3D rendering
  - OrbitControls for camera movement
  - GLTFLoader for model importing
  - JavaScript event listeners for interactions

---

## **Contact**
For more details, questions, or contributions, feel free to contact:  
- Email: [nipunsathsara1999@gmail.com](mailto:nipunsathsara1999@gmail.com)  
- GitHub: [NipunBasnayake](https://github.com/NipunBasnayake)
