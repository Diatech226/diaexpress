import React, { useState, useEffect, useRef } from "react";
import MaterialTable from "material-table";
import { useSelector, useDispatch } from "react-redux";
import CircularLoading from "../components/CircularLoading";
import { api } from "common";
import { makeStyles } from "@mui/styles";
import { useTranslation } from "react-i18next";
import { Modal, Grid, Typography } from "@mui/material";
import Button from "components/CustomButtons/Button.js";
import CancelIcon from "@mui/icons-material/Cancel";
import AlertDialog from "../components/AlertDialog";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import { colors } from "../components/Theme/WebTheme";
import moment from "moment/min/moment-with-locales";
import Switch from "@mui/material/Switch";
import { useNavigate,useLocation } from "react-router-dom";
import EditIcon from '@mui/icons-material/Edit';
import {FONT_FAMILY, SECONDORY_COLOR } from "../common/sharedFunctions";
import { ThemeProvider } from '@mui/material/styles';
import theme from "styles/tableStyle";
import BlankTable from '../components/Table/BlankTable';
import TableStyle from '../components/Table/Style';
import localization from '../components/Table/Localization';
import { getLangKey } from "common/src/other/getLangKey";

const useStyles = makeStyles((theme) => ({
  modal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  submit3: {
    width: "100%",
    borderRadius: 3,
    marginTop: 2,
    padding: 4,
  },
  paper: {
    width: 500,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
}));

export default function CarsList() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir();
  const settings = useSelector((state) => state.settingsdata.settings);
  const userdata = useSelector((state) => state.usersdata);
  const auth = useSelector((state) => state.auth);
  const { updateUserCar, editCar} = api;
  const [driversObj, setDriversObj] = useState();
  const [data, setData] = useState([]);
  const carlistdata = useSelector((state) => state.carlistdata);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const classes = useStyles();
  const [role, setRole] = useState(null);
  const {state} = useLocation()
  const [currentPage,setCurrentPage] = useState(null)

  useEffect(()=>{
    setCurrentPage(state?.pageNo)
  },[state])
  
  const HandalePageChange = (page)=>{
    setCurrentPage(page)
  }

  useEffect(() => {
    if (role !== "driver" && userdata.users) {
      let arr = userdata.users.filter(
        (user) =>
          user.usertype === "driver" &&
          ((role === "fleetadmin" &&
            user.fleetadmin &&
            user.fleetadmin === auth.profile.uid) ||
            role === "admin")
      );
      let obj = {}; 
      for (let i = 0; i < arr.length; i++) {
        let user = arr[i];
        obj[user.id] = `${user.firstName} ${user.lastName} (${
          settings.AllowCriticalEditsAdmin ? user.mobile : t("hidden_demo")
        }) ${settings.AllowCriticalEditsAdmin ? user.email : t("hidden_demo")}`;
      }
      setDriversObj(obj);
    }
  }, [
    userdata.users,
    settings.AllowCriticalEditsAdmin,
    role,
    auth.profile.uid,
    t,
  ]);

  useEffect(() => {
    if (auth.profile && auth.profile.usertype) {
      setRole(auth.profile.usertype);
    }
  }, [auth.profile]);

  useEffect(() => {
    if (carlistdata?.cars && driversObj) { 
   
      const updatedData = carlistdata.cars.map((car) => ({
        ...car,
        driverName: driversObj[car?.driver] || " ",  
      }));
  
      setData(updatedData);
    } else {
      setData([]);
    }
  }, [carlistdata?.cars, driversObj]);

  const [selectedImage, setSelectedImage] = useState(null);
  const handleProfileModal = (e) => {
    setProfileModal(false);
    setSelectedImage(null);
  };

  const [userData, setUserData] = useState();
  const [profileModal, setProfileModal] = useState(false);
  const [imageData, setImageData] = useState(false);
  const [commonAlert, setCommonAlert] = useState({ open: false, msg: "" });
  const [loading, setLoading] = useState(false);

  const handleCommonAlertClose = (e) => {
    e.preventDefault();
    setCommonAlert({ open: false, msg: "" });
  };

  const handleSetProfileModal = (e) => {
    e.preventDefault();
    if(settings.AllowCriticalEditsAdmin){
    if (selectedImage) {
      setLoading(true);
      let finalData = userData;
      finalData.car_image = selectedImage;
      dispatch(editCar(finalData, "UpdateImage"));
      setProfileModal(false);
      setTimeout(() => {
        setSelectedImage(null);
        setLoading(false);
      }, 10000);
    } else {
      setCommonAlert({ open: true, msg: t("choose_image_first") });
    }
    
  }else{
    setCommonAlert({ open: true, msg: t('demo_mode')})
  }
}

  const onClick = (rowData) => {
    setImageData(rowData.car_image);
    setProfileModal(true);
    setUserData(rowData);
  };

  const columns = [
    {
      title: t("createdAt"),
      field: "createdAt",
      editable: "never",
      defaultSort: "desc",
      render: (rowData) =>
        rowData.createdAt ? moment(rowData.createdAt).format("lll") : null,
    },
    {
      title: t("driver"),
      field: "driverName",  
      editable: role === "driver" ? "never" : "always",
      render: (rowData) => rowData.driverName || null,
      
      exportTransformer: (rowData) => rowData.driverName,
      hidden: role === "driver",
    },
    { title: t("car_type"), field: "carType",
      render: (rowData) =>
        rowData.createdAt ? t(getLangKey(rowData.carType)) : null,
    },
    { title: t("vehicle_reg_no"), field: "vehicleNumber" },
    { title: t("vehicle_model_name"), field: "vehicleMake" },
    { title: t("vehicle_model_no"), field: "vehicleModel" },
    { title: t("other_info"), field: "other_info" },
    {
      title: t("image"),
      field: "car_image",
      initialEditValue:
        "https://cdn.pixabay.com/photo/2012/04/13/20/37/car-33556__480.png",
      render: (rowData) =>
        rowData.car_image ? (
          <button
            onClick={() => {
              onClick(rowData);
            }}
          >
            <img alt="CarImage" src={rowData.car_image} style={{ width: 50 }} />
          </button>
        ) : null,
    },
    {
      title: t("active_status"),
      field: "active",
      editable:  "never" ,
      type: "boolean",
      initialEditValue: true,
      render: (rowData) => (
        <Switch
        disabled
          checked={rowData.active}
          onChange={() => handelActiveStatus(rowData)}
        />
      ),
    },
    {
      title: t("approved"),
      field: "approved",
      editable: role === "admin" ? "never" : "always",
      type: "boolean",
      initialEditValue: true,
      render: (rowData) => (
        <Switch
          checked={rowData.approved}
          onChange={() => handelApproved(rowData)}
          disabled={!(settings.AllowCriticalEditsAdmin && settings.carApproval && role === "admin")}
        />
      ),
    },
  ];
  const [selectedRow, setSelectedRow] = useState(null);
  const handelApproved = (rowData) => {

    if (settings.carApproval && role === "admin") {
      dispatch(
        updateUserCar(rowData.driver, {
          carApproved: !rowData.approved,
        })
      );

      dispatch(editCar({ ...rowData, approved: !rowData.approved }, "Update"));
    }
  };
  const handelActiveStatus = (rowData) => {
    const updateData = { ...rowData, active: !rowData.active };
    return updateData;
  };
  return carlistdata.loading ? (
    <CircularLoading />
  ) : (
    <div ref={rootRef}>
    <ThemeProvider theme={theme}>
      { data?.length >0 ? 
      <MaterialTable
        title={t("cars_title")}
        columns={columns}
        onChangePage={(page)=>HandalePageChange(page)}
        style={{
          direction: isRTL === "rtl" ? "rtl" : "ltr",
          borderRadius: "8px",
          boxShadow: `0px 2px 5px ${SECONDORY_COLOR}`,
          padding: "20px",
        }}
        data={data}
        onRowClick={(evt, selectedRow) =>
          setSelectedRow(selectedRow.tableData.id)
        }
        options={{
          initialPage:state?.pageNo,
          exportButton: true,
          rowStyle: (rowData) => ({
            backgroundColor:
              selectedRow === rowData.tableData.id ? colors.ROW_SELECTED :colors.WHITE
          }),
          ...TableStyle()
        }}
        localization={localization(t)}
        editable={{ 
          onRowDelete: (oldData) =>
            settings.AllowCriticalEditsAdmin
              ? new Promise((resolve, reject) => {
                  setTimeout(() => {
                    if (oldData.active) {
                      reject();
                      alert(t("active_car_delete"));
                    } else {
                      resolve();
                      dispatch(editCar(oldData, "Delete"));
                    }
                  }, 600);
                })
              : new Promise((resolve) => {
                  setTimeout(() => {
                    resolve();
                    alert(t("demo_mode"));
                  }, 600);
                }),
        }}
        actions={[    
              {
          icon: 'add',
          tooltip: t("add_car"),
          isFreeAction: true,
          onClick: (event) => navigate(`/cars/editcar`,{state:{pageNo:currentPage}})
        },
        (rowData) => ({
          tooltip: t("edit"),
            icon: () => (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginRight:0
                }}
              >
                <EditIcon />  
              </div>
            ),
            onClick: (event, rowData) =>{
              navigate(`/cars/editcar/${rowData.id}`,{state:{pageNo:currentPage}})
            }
          }),
        
        ]}
      />
      : <BlankTable title={t('cars_title')} 
      actions={[    
        {
        icon: 'add',
        tooltip: t("add_car"),
        isFreeAction: true,
            onClick: (event) => navigate(`/cars/editcar`)
      },
      ]}
      columns={columns}  data={[]} localization={localization(t)} options={TableStyle()}/>}
    </ThemeProvider> 
      <Modal
        disablePortal
        disableEnforceFocus
        disableAutoFocus
        open={profileModal}
        onClose={handleProfileModal}
        className={classes.modal}
        container={() => rootRef.current}
      >
        <Grid
          container
          spacing={1}
          className={classes.paper}
          style={{ direction: isRTL === "rtl" ? "rtl" : "ltr" }}
        >
          <Grid item xs={12} sm={12} md={12} lg={12}>
            <Typography component="h1" variant="h6" style={{ fontFamily: FONT_FAMILY }} >
            {t("upload_car_image")}
              <input
                type="file"
                style={{ marginLeft: 10, fontFamily: FONT_FAMILY }}
                name={t("image")}
                onChange={(event) => {
                  setSelectedImage(event.target.files[0]);
                }}
              />
            </Typography>
          </Grid>
          <Grid item xs={12} sm={12} md={12} lg={12}>
            {selectedImage && !loading ? (
              <Tooltip style={{ fontFamily: FONT_FAMILY }} title={t("cancel")}>
                <CancelIcon
                  onClick={() => setSelectedImage(null)}
                  style={{
                    fontSize: 30,
                    backgroundColor: colors.RED,
                    borderRadius: 50,
                    color: colors.WHITE,
                  }}
                />
              </Tooltip>
            ) : null}
          </Grid>
          <Grid item xs={12} sm={12} md={12} lg={12}>
            {selectedImage ? (
              <img
                alt="not fount"
                width={"200px"}
                height={"200px"}
                src={URL.createObjectURL(selectedImage)}
                style={{ marginTop: 15, marginBottom: 20 }}
              />
            ) : (
              <img
                alt="not fount"
                width={"200px"}
                height={"200px"}
                src={imageData}
                style={{ marginTop: 10 }}
              />
            )}
            <br />
          </Grid>

          <Grid
            item
            xs={12}
            sm={12}
            md={12}
            lg={12}
            style={{ textAlign: isRTL === "rtl" ? "right" : "left" }}
          >
            {loading ? (
              <Grid
                container
                spacing={0}
                alignItems="center"
                justify="center"
                style={{ minHeight: "5vh" }}
              >
                <CircularProgress />
              </Grid>
            ) : (
              <Grid
                item
                xs={12}
                sm={12}
                md={12}
                lg={12}
                style={{ textAlign: isRTL === "rtl" ? "right" : "left" }}
              >
                <Button
                  onClick={handleProfileModal}
                  variant="contained"
                  style={{ backgroundColor:colors.RED, fontFamily: FONT_FAMILY  }}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={handleSetProfileModal}
                  variant="contained"
                  color="secondaryButton"
                  style={{ marginLeft: 10 , backgroundColor:colors.GREEN, fontFamily: FONT_FAMILY  }}
                >
                  {t("save")}
                </Button>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Modal>
      <AlertDialog open={commonAlert.open} onClose={handleCommonAlertClose}>
        {commonAlert.msg}
      </AlertDialog>
    </div>
  );
}
