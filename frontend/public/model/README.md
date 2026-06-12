# PlantVillage TF.js Model

Place your TensorFlow.js model files here:

  public/model/model.json        ← model architecture + weight manifest
  public/model/group1-shard1of1.bin  ← model weights (name may vary)

## How to get the model

Option 1 — Convert your own Keras model:
  pip install tensorflowjs
  tensorflowjs_converter --input_format keras my_model.h5 public/model/

Option 2 — Download a pre-trained PlantVillage MobileNet model:
  https://github.com/imvaibhav507/CNN-PlantVillage-Disease-Classification
  or search Kaggle for "PlantVillage tfjs model"

Option 3 — Use the Teachable Machine export:
  https://teachablemachine.withgoogle.com/ → Image Project → Export → TensorFlow.js

The model must:
  - Accept input shape [null, 224, 224, 3]
  - Output 38 classes matching public/class_names.json
  - Be in Layers format (not GraphModel)

## For the hackathon demo

The app will show an error if no model is found. The UI, upload, and treatment 
advice all work without the model — so you can demo the full flow with a 
placeholder result.
