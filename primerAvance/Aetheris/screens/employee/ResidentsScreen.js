// ResidentsScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useIsFocused } from '@react-navigation/native';
import ResidentCard from '../../components/shared/ResidentCard';
import Config from '../../config/config';
import { useNotification } from '../../src/context/NotificationContext';

const API_URL = Config.API_BASE_URL;
const GRID_CONTAINER_PADDING = 10;
const POLLING_INTERVAL_MS = 3000;
const { width } = Dimensions.get('window');

export default function ResidentsScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [residents, setResidents] = useState([]);
  const [searchText, setSearchText] = useState('');

  const { showNotification } = useNotification();
  const route = useRoute();
  const isFocused = useIsFocused();

  const residentsRef = useRef(residents);
  useEffect(() => {
    residentsRef.current = residents;
  }, [residents]);

  const fetchResidentsData = useCallback(async (initialLoad = false) => {
    if (initialLoad) setIsLoading(true);
    setFetchError('');

    try {
      let currentResidentsData = residentsRef.current;
      
      if (initialLoad || currentResidentsData.length === 0) {
        const residentsResponse = await fetch(`${API_URL}/Residente`);
        if (!residentsResponse.ok) {
          throw new Error(`HTTP error! status: ${residentsResponse.status}`);
        }
        const residentsJson = await residentsResponse.json();

        if (residentsJson && Array.isArray(residentsJson.data)) {
          currentResidentsData = residentsJson.data;
        } else {
          console.warn('La respuesta de la API de residentes no contiene un array en la propiedad "data". Respuesta:', residentsJson);
          currentResidentsData = [];
        }
      }

      const baseStaticUrl = API_URL.replace('/api', '');

      const residentsWithDynamicData = await Promise.all(currentResidentsData.map(async (resident) => {
        let heartRateHistory = [];
        let latestHeartRate = null;

        try {
          const heartRateResponse = await fetch(`${API_URL}/LecturaResidente/${resident.id_residente}`);
          if (heartRateResponse.ok) {
            const heartRateData = await heartRateResponse.json();
            if (Array.isArray(heartRateData) && heartRateData.length > 0) {
              const sortedData = heartRateData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              
              heartRateHistory = sortedData.map(record => record.ritmoCardiaco);
              if (sortedData.length > 0) {
                latestHeartRate = sortedData[0].ritmoCardiaco;
              }
            }
          } else {
            console.warn(`No se pudo obtener la frecuencia cardíaca para el residente ${resident.id_residente}: ${heartRateResponse.statusText}`);
          }
        } catch (error) {
          console.error(`Error al obtener la frecuencia cardíaca para el residente ${resident.id_residente}:`, error);
        }

        return {
          ...resident,
          foto_url: resident.foto && resident.foto !== 'nophoto.png' ? `${baseStaticUrl}/images/residents/${resident.foto}` : null,
          historial_frecuencia_cardiaca: heartRateHistory,
          ultima_frecuencia_cardiaca: latestHeartRate,
        };
      }));

      setResidents(residentsWithDynamicData);
    } catch (error) {
      console.error('Error al obtener residentes:', error);
      setFetchError('No se pudieron cargar los residentes. Intenta de nuevo más tarde.');
      if (initialLoad) showNotification('Error al cargar residentes.', 'error');
    } finally {
      if (initialLoad) setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    let pollingInterval;
    if (isFocused) {
      fetchResidentsData(true);
      pollingInterval = setInterval(() => {
        fetchResidentsData(false);
      }, POLLING_INTERVAL_MS);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [isFocused, fetchResidentsData]);

  useEffect(() => {
    if (route.params?.registrationSuccess) {
      showNotification('Residente registrado exitosamente!', 'success');
      navigation.setParams({ registrationSuccess: undefined });
    }
  }, [route.params?.registrationSuccess, showNotification, navigation]);

  const handleAddNewResident = () => {
    navigation.navigate('RegisterResidentAndFamiliar');
  };

  const handleViewProfile = (id) => {
    showNotification(`Navegando a perfil del residente con ID: ${id}`, 'info');
  };

  const handleHistory = (id) => {
    showNotification(`Navegando a historial médico del residente con ID: ${id}`, 'info');
  };

  const handleEditResident = (id) => {
    showNotification(`Navegando a edición del residente con ID: ${id}`, 'info');
  };

  const handleAssignDevice = (residentId) => {
    showNotification(`Navegando a la asignación de dispositivo para el residente con ID: ${residentId}`, 'info');
  };

  const filteredResidents = residents.filter(resident =>
    resident.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
    resident.apellido.toLowerCase().includes(searchText.toLowerCase()) ||
    (resident.nombre_area && resident.nombre_area.toLowerCase().includes(searchText.toLowerCase()))
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.searchFilterContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar residente..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterButtonText}>Filtros</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={handleAddNewResident}>
          <Ionicons name="person-add" size={20} color={styles.createButtonText.color} />
          <Text style={styles.createButtonText}>NUEVO RESIDENTE</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#10B981" style={styles.loadingIndicator} />
      ) : fetchError ? (
        <Text style={styles.errorText}>{fetchError}</Text>
      ) : filteredResidents.length === 0 ? (
        <Text style={styles.noResidentsText}>No hay residentes registrados que coincidan con la búsqueda.</Text>
      ) : (
        <ScrollView style={styles.scrollView}>
          <View style={styles.residentsGrid}>
            {filteredResidents.map((resident) => (
              <ResidentCard
                key={resident.id_residente}
                resident={resident}
                onEdit={handleEditResident}
                onViewProfile={handleViewProfile}
                onHistory={handleHistory}
                onAssignDevice={handleAssignDevice} 
                gridContainerPadding={GRID_CONTAINER_PADDING}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    paddingTop: Platform.OS === 'android' ? 30 : 10,
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#6BB240',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: 'transparent',
    elevation: 0,
    marginLeft: 10,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
    maxWidth: 300,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  filterButtonText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  residentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: GRID_CONTAINER_PADDING,
  },
  loadingIndicator: {
    marginTop: 50,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  noResidentsText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#6B7280',
  },
});