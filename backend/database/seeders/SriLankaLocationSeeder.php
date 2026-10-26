<?php

namespace Database\Seeders;

use App\Models\City;
use App\Models\District;
use Illuminate\Database\Seeder;

/** Seeds all 25 Sri Lanka districts with a starter set of cities — platform admins can add more via platform/cities. */
class SriLankaLocationSeeder extends Seeder
{
    private const DISTRICTS = [
        'Colombo' => ['Colombo', 'Dehiwala-Mount Lavinia', 'Moratuwa', 'Sri Jayawardenepura Kotte', 'Kaduwela', 'Homagama', 'Maharagama', 'Ja-Ela'],
        'Gampaha' => ['Gampaha', 'Negombo', 'Wattala', 'Minuwangoda', 'Katunayake', 'Kelaniya', 'Veyangoda', 'Nittambuwa'],
        'Kalutara' => ['Kalutara', 'Panadura', 'Horana', 'Matugama', 'Beruwala', 'Aluthgama', 'Bandaragama'],
        'Kandy' => ['Kandy', 'Katugastota', 'Gampola', 'Nawalapitiya', 'Peradeniya', 'Akurana', 'Wattegama'],
        'Matale' => ['Matale', 'Dambulla', 'Galewela', 'Ukuwela', 'Rattota'],
        'Nuwara Eliya' => ['Nuwara Eliya', 'Hatton', 'Talawakele', 'Ginigathhena', 'Nanu Oya'],
        'Galle' => ['Galle', 'Ambalangoda', 'Hikkaduwa', 'Elpitiya', 'Baddegama'],
        'Matara' => ['Matara', 'Weligama', 'Akuressa', 'Dikwella', 'Kamburupitiya'],
        'Hambantota' => ['Hambantota', 'Tangalle', 'Tissamaharama', 'Beliatta', 'Ambalantota'],
        'Jaffna' => ['Jaffna', 'Chavakachcheri', 'Point Pedro', 'Nallur', 'Kopay'],
        'Kilinochchi' => ['Kilinochchi', 'Pallai', 'Paranthan'],
        'Mannar' => ['Mannar', 'Nanattan', 'Pesalai'],
        'Vavuniya' => ['Vavuniya', 'Nedunkeni', 'Omanthai'],
        'Mullaitivu' => ['Mullaitivu', 'Puthukkudiyiruppu', 'Oddusuddan'],
        'Batticaloa' => ['Batticaloa', 'Kaluwanchikudy', 'Eravur', 'Valaichchenai'],
        'Ampara' => ['Ampara', 'Kalmunai', 'Sainthamaruthu', 'Akkaraipattu', 'Dehiattakandiya'],
        'Trincomalee' => ['Trincomalee', 'Kinniya', 'Mutur', 'Kantalai'],
        'Kurunegala' => ['Kurunegala', 'Kuliyapitiya', 'Pannala', 'Wariyapola', 'Narammala'],
        'Puttalam' => ['Puttalam', 'Chilaw', 'Wennappuwa', 'Nattandiya', 'Anamaduwa'],
        'Anuradhapura' => ['Anuradhapura', 'Kekirawa', 'Mihintale', 'Medawachchiya', 'Thambuttegama'],
        'Polonnaruwa' => ['Polonnaruwa', 'Hingurakgoda', 'Medirigiriya', 'Kaduruwela'],
        'Badulla' => ['Badulla', 'Bandarawela', 'Haputale', 'Welimada', 'Mahiyanganaya'],
        'Monaragala' => ['Monaragala', 'Wellawaya', 'Bibile', 'Kataragama'],
        'Ratnapura' => ['Ratnapura', 'Balangoda', 'Embilipitiya', 'Pelmadulla', 'Eheliyagoda'],
        'Kegalle' => ['Kegalle', 'Mawanella', 'Warakapola', 'Rambukkana', 'Deraniyagala'],
    ];

    public function run(): void
    {
        foreach (self::DISTRICTS as $districtName => $cities) {
            $district = District::firstOrCreate(['name' => $districtName]);

            foreach ($cities as $cityName) {
                City::firstOrCreate(['district_id' => $district->id, 'name' => $cityName]);
            }
        }
    }
}
